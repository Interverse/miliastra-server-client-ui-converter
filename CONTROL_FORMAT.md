# Additional control reference

The supplied `z_scoreboard.gia` is a Server group (resource class 21) with 67 text boxes and 16 images. `z_clientcontrol.gia` is a Client container (class 70) holding ten kinds of controls. The site bundles only the extracted component metadata, in `js/control-profiles.js`; it does not need either reference file at runtime.

## Mapped controls

| Control   | Server component |    Client component | Client transform discriminator |
| --------- | ---------------: | ------------------: | -----------------------------: |
| Text box  |               25 |                  84 |                             31 |
| Image     |               38 |              96, 97 |                             23 |
| Container |   group class 21 | 91 / group class 70 |                             25 |

Common names and transforms retain their original raw fields. Target-specific common components are cloned from the actual editor exports and their GUID locators are patched. Every parent child list is reversed across sides, without detaching any child's index, geometry or settings. Mixed control conversion supports container children as well as multiple groups.

## Text mapping

Server settings are in component 25/detail field 19; Client text style is in component 84/detail field 75. The populated `Text Box - Fixed` in `z_scoreboard_2.gia` verifies the complete generated settings for the Server `Text Box`, including the `Players` label, color, alignment and sizing.

|                                              Server field |                                      Client field |
| --------------------------------------------------------: | ------------------------------------------------: |
|                                                502 (size) | 512 (auto-size maximum), or 501 for static sizing |
|                                503 (horizontal alignment) |                                               508 |
|                                  504 (vertical alignment) |                                               509 |
| 505 (nested text wrapper, including variable expressions) |                                510 (same wrapper) |
|                                         506 (auto-sizing) |                                               502 |
|                                        507 (minimum size) |                                               513 |
|                                          510 (text color) |                                               504 |
|                                                       511 |                                               505 |
|                                                       515 |                                               507 |

Client fields 501 and 503 retain the reference defaults of 20 and 12 when automatic sizing is enabled. The inactive static size is used when automatic sizing is disabled. Server field 512 has no established Client equivalent; only its supplied default is accepted, and that default is restored on reverse conversion. Non-default Client fonts and other unmapped settings are rejected.

The repaired `Score BG - Fixed` image confirms Server image option field 5 maps to Client image field 504, not 501. Regression tests compare generated image settings and every generated text setting against the independent repaired controls.

The tests verify each mapped field, all four platform transforms, nested text wrappers and variable expressions, image IDs and colors, child order, both Classic/Beyond modes, and both directions. The supplied editor exports establish the field encodings; newly generated full bundles still require an in-game rendering check.

## Controls without a mapped Server equivalent

Reference, Grid Scroller, Cursor Event Area, Key Hint, Preset Button, Fullscreen UI Animation, UI Animation, and Text Window are recognized from their Client components. No Server references establishing counterparts were supplied. A file containing these controls shows their names and disables conversion. This is a mapping limitation, not a claim that every such control is inherently impossible on Server.

Mixed groups with masks, non-default Client image effects, unknown components or unknown text settings are rejected rather than converted with settings missing. Existing standalone image/mask conversion continues to use its original validated path.
