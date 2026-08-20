<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Customer delivery address book.
 *
 * Until now a customer had exactly one address: a `users.address` varchar that
 * sometimes held plain text and sometimes a JSON blob with map coordinates.
 * That cannot express "home and office", cannot mark a default, and loses the
 * recipient's name and phone when they differ from the account holder's.
 *
 * This adds a proper table alongside that column — the legacy column is left
 * in place and still written by the older endpoints, so nothing that reads it
 * today breaks. The existing values are copied in rather than abandoned, so
 * customers who already saved an address keep it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('addresses')) {
            Schema::create('addresses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();

                // Whoever is receiving the parcel — not necessarily the account
                // holder, which is why these are stored per address.
                $table->string('full_name');
                $table->string('phone', 40);

                // Tanzanian addressing: region → district → ward/area → street.
                // Only region and city are mandatory; much of the country has no
                // formal street naming, so the rest stays optional and the
                // free-text landmark line carries the real directions.
                $table->string('region');
                $table->string('city');
                $table->string('district')->nullable();
                $table->string('street')->nullable();
                $table->text('details')->nullable();

                // Kept from the old map-picker payload so a saved pin is not lost.
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();

                $table->boolean('is_default')->default(false);
                $table->timestamps();

                $table->index(['user_id', 'is_default']);
            });
        }

        $this->backfillFromUsers();
    }

    /**
     * Copy each customer's existing single address into the new book.
     *
     * Runs only for users who have no rows yet, so re-running the migration
     * cannot duplicate anyone. Values are read, never modified or cleared.
     */
    private function backfillFromUsers(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'address')) {
            return;
        }

        $existing = DB::table('addresses')->distinct()->pluck('user_id')->all();

        DB::table('users')
            ->whereNotNull('address')
            ->where('address', '!=', '')
            ->when($existing, fn ($q) => $q->whereNotIn('id', $existing))
            ->orderBy('id')
            ->chunkById(200, function ($users) {
                $rows = [];
                $now  = now();

                foreach ($users as $user) {
                    $raw = trim((string) $user->address);
                    if ($raw === '') {
                        continue;
                    }

                    // Two shapes exist in production: a JSON object from the map
                    // picker, and bare text typed at checkout.
                    $decoded = json_decode($raw, true);
                    $line    = is_array($decoded) ? trim((string) ($decoded['address'] ?? '')) : $raw;
                    $lat     = is_array($decoded) ? ($decoded['lat'] ?? null) : null;
                    $lng     = is_array($decoded) ? ($decoded['lng'] ?? null) : null;

                    if ($line === '') {
                        continue;
                    }

                    $rows[] = [
                        'user_id'    => $user->id,
                        'full_name'  => $user->name ?: 'Recipient',
                        'phone'      => (string) ($user->phone ?? ''),
                        // The old field was one unstructured line, so the region
                        // and city cannot be recovered from it. Defaulting them
                        // would invent data; the line itself is preserved intact
                        // in `details` and the customer completes the rest when
                        // they next edit the address.
                        'region'     => '',
                        'city'       => '',
                        'district'   => null,
                        'street'     => null,
                        'details'    => $line,
                        'latitude'   => is_numeric($lat) ? $lat : null,
                        'longitude'  => is_numeric($lng) ? $lng : null,
                        'is_default' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if ($rows) {
                    DB::table('addresses')->insert($rows);
                }
            });
    }

    /**
     * Deliberately does not drop the table: it holds customer-entered delivery
     * details that exist nowhere else once written. Removing it is a manual,
     * considered act, not something a rollback should do silently.
     */
    public function down(): void
    {
    }
};
