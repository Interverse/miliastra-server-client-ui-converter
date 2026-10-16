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

## Export types

`ServerControlTemplate.gia` establishes primary resource class 21 for Server Control Templates, containing image (38), UI animation (39), fullscreen animation (57), and text (25) controls. Asset Groups use class 61 and Client Control Templates use class 70. The UI detects these independently of the underlying Server/Client component family. The three-argument conversion API `convertUiGia(bytes, targetTemplate, targetFormat)` accepts `asset-group`, `server-control`, or `client-control`. Omitting the third argument retains the earlier automatic Server/Client behavior for existing callers.

Same-side Server conversions retain child payloads and hierarchy order; cross-side conversions use the established property mappings. Standalone primary controls are wrapped in an Asset Group container when needed. Format tests cover all six directions, both modes, masked image groups, bundled groups, standalone animation controls and the supplied mixed-control Server template. Server Control Template parents are rebuilt from the supplied working reference: name/common components 15/23, info slots 1/2/4/6 with slot 6 type 13, and no mask or root rect transform. Parent translation is baked into the children on each platform. Embedded metadata GUIDs are patched after bundle remapping. Active masks are intentionally discarded for this target; returning to Asset Group or Client cannot recover them. In-game import confirmation remains separate from these structural checks.

Asset Group output is likewise rebuilt from `z_ui_animation_server_asset_group.gia`, including type-55 parent metadata, the Asset Group export provenance, and transform/mask components. An absent parent transform is sized to the projected bounds of its children on each platform, using their scale and full rotation. The parent is centered on those bounds and child offsets are rebased to preserve their positions. The same bounds calculation is used for mixed-control Client parents; an absent mask is replaced with the reference disabled mask, so this does not recover previously discarded masking. Existing Asset Group transforms and masks remain intact. Class-only relabeling is not a valid export conversion. Runtime validation checks both output schemas after bundle GUID remapping.
