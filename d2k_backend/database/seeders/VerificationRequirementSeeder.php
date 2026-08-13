<?php

namespace Database\Seeders;

use App\Models\VerificationRequirement;
use Illuminate\Database\Seeder;

/**
 * A sensible starting set of verification paperwork for Tanzania.
 *
 * Only the identity document is mandatory: a Kariakoo trader may legitimately
 * not hold a company registration, and demanding one from everybody would
 * block exactly the sellers this marketplace exists for. Administrators can
 * change all of this from the Verification requirements screen.
 *
 * Idempotent — matched on name, so re-running never duplicates or overwrites
 * an administrator's edits.
 */
class VerificationRequirementSeeder extends Seeder
{
    public function run(): void
    {
        $requirements = [
            [
                'name'          => 'National ID (NIDA)',
                'description'   => 'A clear photo of your NIDA card, or your 20-digit NIDA number.',
                'document_type' => 'file',
                'is_required'   => true,
                'sort_order'    => 1,
            ],
            [
                'name'          => 'Business licence',
                'description'   => 'Your trading licence, if your business holds one.',
                'document_type' => 'file',
                'is_required'   => false,
                'sort_order'    => 2,
            ],
            [
                'name'          => 'TIN number',
                'description'   => 'Your Taxpayer Identification Number, if registered.',
                'document_type' => 'text',
                'is_required'   => false,
                'sort_order'    => 3,
            ],
            [
                'name'          => 'Business registration certificate',
                'description'   => 'BRELA certificate for registered companies.',
                'document_type' => 'file',
                'is_required'   => false,
                'sort_order'    => 4,
            ],
            [
                'name'          => 'Proof of business address',
                'description'   => 'A photo of your shop front or a utility bill showing the address.',
                'document_type' => 'file',
                'is_required'   => false,
                'sort_order'    => 5,
            ],
        ];

        foreach ($requirements as $requirement) {
            VerificationRequirement::firstOrCreate(
                ['name' => $requirement['name']],
                $requirement + ['is_active' => true],
            );
        }
    }
}
