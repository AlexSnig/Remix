# Release notes

## 1.1.0 — Device Owner kiosk foundation

- Added persistent Home / Device Owner / Lock Task support for dedicated
  exhibition phones.
- Added boot resume from visible `MainActivity`, never from a background boot
  receiver.
- Persisted verified audio-route fingerprint, calibration and motion-test
  evidence in native storage.
- Added native-only kiosk/boot status, PIN-protected operator maintenance,
  and boot diagnostics.
- Hardened audio safety: approved AUX or exact approved Bluetooth only; no
  handset speaker fallback after a reboot or route change.

This release requires factory-reset Device Owner provisioning and a physical
target-phone cold-boot acceptance test before it may be called production
ready.
