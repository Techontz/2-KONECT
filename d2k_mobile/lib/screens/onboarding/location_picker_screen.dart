import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/app_controllers.dart';
import '../../widgets/states.dart';

/// What the picker hands back: a real coordinate plus whatever the reverse
/// geocoder could name it. The backend stores latitude/longitude on the same
/// `addresses` row the website writes, so a place pinned on the phone is the
/// same record the web checkout sees.
class PickedPlace {
  const PickedPlace({
    required this.latitude,
    required this.longitude,
    this.street,
    this.area,
    this.city,
  });

  final double latitude;
  final double longitude;
  final String? street;
  final String? area;
  final String? city;

  String get label => [street, area, city]
      .where((part) => part != null && part.trim().isNotEmpty)
      .join(', ');
}

/// Pick a delivery point on a real Google map.
///
/// The pin is fixed at the centre of the screen and the map moves under it —
/// the same interaction the website's picker uses, and the one that works with
/// a thumb. Every failure mode is handled explicitly: a denied permission, a
/// dead GPS, no network and a map that will not load each say what happened
/// rather than leaving a blank grey rectangle.
class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({
    super.key,
    this.initialLatitude,
    this.initialLongitude,
  });

  final double? initialLatitude;
  final double? initialLongitude;

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  /// Kariakoo — the right default for this marketplace.
  static const LatLng _kariakoo = LatLng(-6.8161, 39.2803);

  GoogleMapController? _map;
  late LatLng _target = LatLng(
    widget.initialLatitude ?? _kariakoo.latitude,
    widget.initialLongitude ?? _kariakoo.longitude,
  );

  String? _addressLabel;
  String? _notice;
  bool _resolving = false;
  bool _locating = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _resolveLabel();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _map?.dispose();
    super.dispose();
  }

  /// Reverse-geocodes the pin, debounced so panning does not fire a request
  /// per frame.
  void _scheduleResolve() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), _resolveLabel);
  }

  Future<void> _resolveLabel() async {
    if (!mounted) return;
    setState(() => _resolving = true);

    try {
      final places = await placemarkFromCoordinates(
        _target.latitude,
        _target.longitude,
      );
      if (!mounted) return;

      final place = places.isEmpty ? null : places.first;
      setState(() {
        _addressLabel = place == null
            ? null
            : [
                place.street,
                place.subLocality,
                place.locality,
              ].where((p) => p != null && p.trim().isNotEmpty).join(', ');
        _resolving = false;
      });
    } catch (_) {
      // No network, or no geocoder on the device. The coordinate is still
      // perfectly usable, so this is a missing label, not a failure.
      if (mounted) {
        setState(() {
          _addressLabel = null;
          _resolving = false;
        });
      }
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _notice = null;
    });

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _fail('Location is turned off on this device. Turn on GPS and retry.');
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        _fail('Location permission denied. You can still pan the map to pick a spot.');
        return;
      }
      if (permission == LocationPermission.deniedForever) {
        _fail('Location permission is blocked. Enable it in Settings, or pan the map instead.');
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );

      if (!mounted) return;
      final here = LatLng(position.latitude, position.longitude);
      setState(() {
        _target = here;
        _locating = false;
      });
      await _map?.animateCamera(CameraUpdate.newLatLngZoom(here, 16.5));
      _resolveLabel();
    } on TimeoutException {
      _fail('Could not get a GPS fix. Move to an open area or pan the map.');
    } catch (error) {
      _fail('Location unavailable: $error');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() {
      _locating = false;
      _notice = message;
    });
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _notice = null);

    try {
      final results = await locationFromAddress(query);
      if (!mounted || results.isEmpty) {
        _fail('No place matched "$query".');
        return;
      }
      final found = LatLng(results.first.latitude, results.first.longitude);
      setState(() => _target = found);
      await _map?.animateCamera(CameraUpdate.newLatLngZoom(found, 16));
      _resolveLabel();
    } catch (_) {
      _fail('Search needs a network connection. Check your signal and retry.');
    }
  }

  void _confirm() {
    final parts = (_addressLabel ?? '').split(',').map((p) => p.trim()).toList();

    Navigator.of(context).pop(
      PickedPlace(
        latitude: _target.latitude,
        longitude: _target.longitude,
        street: parts.isNotEmpty ? parts.first : null,
        area: parts.length > 1 ? parts[1] : null,
        city: parts.length > 2 ? parts.last : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: Text(strings.confirmLocation)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 10, AppSpacing.gutter, 8),
            child: TextField(
              textInputAction: TextInputAction.search,
              onSubmitted: _search,
              decoration: InputDecoration(
                hintText: strings.searchBuildingArea,
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: AppColors.tileSurface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: [
                GoogleMap(
                  initialCameraPosition: CameraPosition(target: _target, zoom: 15),
                  onMapCreated: (controller) => _map = controller,
                  onCameraMove: (position) => _target = position.target,
                  onCameraIdle: _scheduleResolve,
                  myLocationEnabled: false,
                  myLocationButtonEnabled: false,
                  zoomControlsEnabled: false,
                  mapToolbarEnabled: false,
                ),

                // A fixed pin over a moving map: the target is always the
                // centre, which is far easier than dragging a marker.
                IgnorePointer(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 28),
                    child: Icon(
                      Icons.location_on,
                      size: 42,
                      color: AppColors.primary,
                      shadows: const [
                        Shadow(color: Colors.black26, blurRadius: 6),
                      ],
                    ),
                  ),
                ),

                Positioned(
                  right: 14,
                  bottom: 14,
                  child: FloatingActionButton.small(
                    heroTag: 'd2k-locate',
                    backgroundColor: AppColors.surface,
                    onPressed: _locating ? null : _useCurrentLocation,
                    child: _locating
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.my_location,
                            size: 19, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.gutter),
              color: AppColors.surface,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_notice != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF4E0),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Text(_notice!, style: AppTypography.metaMuted),
                    ),
                    const SizedBox(height: 10),
                  ],
                  Row(
                    children: [
                      const Icon(Icons.place_outlined,
                          size: 17, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _resolving
                              ? '${strings.searchYourLocation}…'
                              : (_addressLabel?.isNotEmpty == true
                                  ? _addressLabel!
                                  : '${_target.latitude.toStringAsFixed(5)}, '
                                      '${_target.longitude.toStringAsFixed(5)}'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: strings.confirmLocation,
                    expand: true,
                    height: 50,
                    onPressed: _confirm,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Onboarding still needs the "where do we deliver" step; it now reuses the
/// real picker and stores the chosen area on the device.
Future<void> pickDeliveryArea(BuildContext context) async {
  final picked = await Navigator.of(context).push<PickedPlace>(
    MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
  );

  if (picked == null || !context.mounted) return;

  await context.read<LocationController>().setLocation(
        area: picked.area ?? picked.street ?? 'Kariakoo',
        city: picked.city ?? 'Dar es Salaam',
      );
}
