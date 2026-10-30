# #1151 — empty catalogue spacing

Synthetic demo only, Chromium151.0.7922.34, DPR1,980×820, dark EN. [Before](before.png): computed padding0px; [after](after.png):16px. The text and outer878px box are unchanged. Both screenshots inspected. Before was measured on the #1145 candidate whose empty-state selector still used the unmodified --sp-8; the #1151 candidate changes only this selector to --sp-6.

node demo/smoke_device_inbox.mjs → PASS: real unmatched filter, desktop16px padding;390px padding16 and within viewport; config/layout unchanged. Existing native catalog navigation, nested edit/cancel and read-only witnesses still pass. No controls, filtering or writes changed.

SHA256: before cda5261a9f6ca7d59f58052ef705ec212950b04b170e0941d346b9a3d8ee8047; after 34d1db6b7dc750e25d88260b685ae8acf42af36dbcbaf3f9714a3ee006e4d74a.
