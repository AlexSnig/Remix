# Approved narration master

`+Сходи.MP3` is the only approved Exhibit Motion narration master.

- Duration: 14.08 seconds
- Size: 337,970 bytes
- Bit rate: approximately 192 kbps
- SHA-256:
  `b28f4ca1f08414dfeb609d30e3b30c4124f1215f07830cf5c6d6c2039f476e6e`

This exact approved master is not automatically duplicated into the bundled
catalog. The separate repository `audio/` folder is packaged into every APK and
is selectable offline; choosing an entry copies and validates it in app-private
storage. If the installation requires this exact `+Сходи.MP3` master, copy it
to the phone and use manual import through the native operator workflow.

Do not treat presence in the bundled catalog as physical audio approval. The
selected narration still requires a person to confirm the intended AUX or named
Bluetooth speaker by ear on each phone.

Do not replace the master silently. Any intentional audio change requires a new
checksum, a real AUX/Bluetooth listening test, motion/playback acceptance, and
an update to `docs/PROJECT_STATE.md`.
