# HAWKEYE-STERLING-RA: country coverage gaps (195 countries)

Generated from `data/sanctions-country-coverage.json`, `data/screening-country-coverage.json` and the `LOCALES` matrix in `scripts/adverse-media.mjs`. Register updated: 2026-10-08.

## How to read this

- **Sanctions status** is the register's own status. `not-researched` = no outcome recorded (27). `identified` = list known, file not verified (37). `pending` = candidate recorded, not loaded (2). `assessed-not-loadable` = researched, cannot be loaded (75). `screened` = national list loaded (54).
- **AM edition** = whether a dedicated Google News country edition exists in the adverse-media matrix. `no` does not mean zero adverse-media coverage: GDELT and Bing News sweeps are global and name-scoped.
- **Partial note** = a not-researched country that already has a partial research note in the register.
- **PEP worldwide scope** means the configured screen applies to subjects across the country universe; it does not prove that Wikidata has complete, current PEP records for every country. The PEP artifact is assessed separately by runtime assurance.
- PEP person counts are not allocated by country here: office context can be missing or refer to a jurisdiction, and must not be presented as a complete country register.
- UN consolidated list screening is independent of these national-list statuses.

## Full 195-country screening applicability matrix

This matrix separates global sanctions baseline and PEP/adverse-media scope from national sanctions source depth and dedicated Google News edition presence. Configured scope does not replace per-run operational evidence.

| Country | Sanctions global baseline | National sanctions status | Loaded national source IDs | Adverse-media global scope | Google News country edition | Worldwide PEP scope |
|---|---|---|---|---|---|---|
| Afghanistan | yes | not-researched | — | yes | no | yes |
| Albania | yes | identified | — | yes | no | yes |
| Algeria | yes | identified | — | yes | no | yes |
| Andorra | yes | assessed-not-loadable | — | yes | no | yes |
| Angola | yes | not-researched | — | yes | no | yes |
| Antigua and Barbuda | yes | not-researched | — | yes | no | yes |
| Argentina | yes | screened | ar-repet, ar-repet-entidades | yes | yes | yes |
| Armenia | yes | identified | — | yes | no | yes |
| Australia | yes | screened | au-dfat, au-dfat-opensanctions | yes | yes | yes |
| Austria | yes | screened | at-oenb-terror | yes | yes | yes |
| Azerbaijan | yes | screened | az-fiu | yes | no | yes |
| Bahamas | yes | assessed-not-loadable | — | yes | no | yes |
| Bahrain | yes | screened | bh-gazette | yes | yes | yes |
| Bangladesh | yes | identified | — | yes | yes | yes |
| Barbados | yes | not-researched | — | yes | no | yes |
| Belarus | yes | identified | — | yes | no | yes |
| Belgium | yes | screened | be-fod | yes | yes | yes |
| Belize | yes | pending | bz-fiu-consolidated | yes | no | yes |
| Benin | yes | not-researched | — | yes | no | yes |
| Bhutan | yes | not-researched | — | yes | no | yes |
| Bolivia | yes | assessed-not-loadable | — | yes | no | yes |
| Bosnia and Herzegovina | yes | not-researched | — | yes | no | yes |
| Botswana | yes | not-researched | — | yes | no | yes |
| Brazil | yes | screened | br-bcb-qgi, br-bcb-qgp, br-tcu-inabilitados, br-tcu-inidoneos | yes | yes | yes |
| Brunei | yes | not-researched | — | yes | no | yes |
| Bulgaria | yes | screened | bg-dans-mft | yes | yes | yes |
| Burkina Faso | yes | identified | — | yes | no | yes |
| Burundi | yes | not-researched | — | yes | no | yes |
| Cabo Verde | yes | not-researched | — | yes | no | yes |
| Cambodia | yes | not-researched | — | yes | no | yes |
| Cameroon | yes | not-researched | — | yes | no | yes |
| Canada | yes | screened | ca-sema | yes | yes | yes |
| Central African Republic | yes | not-researched | — | yes | no | yes |
| Chad | yes | not-researched | — | yes | no | yes |
| Chile | yes | assessed-not-loadable | — | yes | yes | yes |
| China | yes | identified | — | yes | yes | yes |
| Colombia | yes | assessed-not-loadable | — | yes | yes | yes |
| Comoros | yes | not-researched | — | yes | no | yes |
| Congo | yes | not-researched | — | yes | no | yes |
| Costa Rica | yes | assessed-not-loadable | — | yes | no | yes |
| Côte d'Ivoire | yes | screened | ci-centif-1373 | yes | no | yes |
| Croatia | yes | assessed-not-loadable | — | yes | no | yes |
| Cuba | yes | identified | — | yes | no | yes |
| Cyprus | yes | not-researched | — | yes | no | yes |
| Czechia | yes | screened | cz-mzv-national | yes | yes | yes |
| Democratic People's Republic of Korea | yes | not-researched | — | yes | no | yes |
| Democratic Republic of the Congo | yes | not-researched | — | yes | no | yes |
| Denmark | yes | assessed-not-loadable | — | yes | no | yes |
| Djibouti | yes | not-researched | — | yes | no | yes |
| Dominica | yes | not-researched | — | yes | no | yes |
| Dominican Republic | yes | assessed-not-loadable | — | yes | no | yes |
| Ecuador | yes | identified | — | yes | no | yes |
| Egypt | yes | screened | eg-mlcu | yes | yes | yes |
| El Salvador | yes | assessed-not-loadable | — | yes | no | yes |
| Equatorial Guinea | yes | not-researched | — | yes | no | yes |
| Eritrea | yes | not-researched | — | yes | no | yes |
| Estonia | yes | screened | ee-vm-belarus, ee-vm-human-rights, ee-vm-russia-ukraine | yes | yes | yes |
| Eswatini | yes | not-researched | — | yes | no | yes |
| Ethiopia | yes | identified | — | yes | no | yes |
| Fiji | yes | assessed-not-loadable | — | yes | no | yes |
| Finland | yes | assessed-not-loadable | — | yes | yes | yes |
| France | yes | screened | fr-dgt | yes | yes | yes |
| Gabon | yes | not-researched | — | yes | no | yes |
| Gambia | yes | not-researched | — | yes | no | yes |
| Georgia | yes | screened | ge-ot-list | yes | no | yes |
| Germany | yes | assessed-not-loadable | — | yes | yes | yes |
| Ghana | yes | assessed-not-loadable | — | yes | yes | yes |
| Greece | yes | identified | — | yes | yes | yes |
| Grenada | yes | not-researched | — | yes | no | yes |
| Guatemala | yes | assessed-not-loadable | — | yes | no | yes |
| Guinea | yes | not-researched | — | yes | no | yes |
| Guinea-Bissau | yes | not-researched | — | yes | no | yes |
| Guyana | yes | identified | — | yes | no | yes |
| Haiti | yes | not-researched | — | yes | no | yes |
| Holy See | yes | identified | — | yes | no | yes |
| Honduras | yes | assessed-not-loadable | — | yes | no | yes |
| Hungary | yes | identified | — | yes | yes | yes |
| Iceland | yes | assessed-not-loadable | — | yes | no | yes |
| India | yes | screened | in-mha | yes | yes | yes |
| Indonesia | yes | screened | id-dttot | yes | yes | yes |
| Iran | yes | not-researched | — | yes | no | yes |
| Iraq | yes | screened | iq-aml-freeze | yes | yes | yes |
| Ireland | yes | assessed-not-loadable | — | yes | yes | yes |
| Israel | yes | screened | il-nbctf, il-nbctf-orgs | yes | yes | yes |
| Italy | yes | assessed-not-loadable | — | yes | yes | yes |
| Jamaica | yes | assessed-not-loadable | — | yes | no | yes |
| Japan | yes | screened | jp-mof | yes | yes | yes |
| Jordan | yes | screened | jo-amlu | yes | yes | yes |
| Kazakhstan | yes | assessed-not-loadable | — | yes | no | yes |
| Kenya | yes | screened | ke-frc | yes | yes | yes |
| Kiribati | yes | not-researched | — | yes | no | yes |
| Kuwait | yes | not-researched | — | yes | yes | yes |
| Kyrgyzstan | yes | screened | kg-fiu-public | yes | no | yes |
| Laos | yes | not-researched | — | yes | no | yes |
| Latvia | yes | screened | lv-fid | yes | yes | yes |
| Lebanon | yes | screened | lb-isf-ntfl | yes | yes | yes |
| Lesotho | yes | not-researched | — | yes | no | yes |
| Liberia | yes | not-researched | — | yes | no | yes |
| Libya | yes | not-researched | — | yes | no | yes |
| Liechtenstein | yes | assessed-not-loadable | — | yes | no | yes |
| Lithuania | yes | screened | lt-migracija-magnitsky | yes | yes | yes |
| Luxembourg | yes | assessed-not-loadable | — | yes | no | yes |
| Madagascar | yes | not-researched | — | yes | no | yes |
| Malawi | yes | assessed-not-loadable | — | yes | no | yes |
| Malaysia | yes | screened | my-moha | yes | yes | yes |
| Maldives | yes | identified | — | yes | no | yes |
| Mali | yes | identified | — | yes | no | yes |
| Malta | yes | assessed-not-loadable | — | yes | no | yes |
| Marshall Islands | yes | not-researched | — | yes | no | yes |
| Mauritania | yes | not-researched | — | yes | no | yes |
| Mauritius | yes | screened | mu-nssec | yes | no | yes |
| Mexico | yes | screened | mx-sat-69b | yes | yes | yes |
| Micronesia | yes | not-researched | — | yes | no | yes |
| Moldova | yes | screened | md-sis-terror | yes | no | yes |
| Monaco | yes | screened | mc-gels | yes | no | yes |
| Mongolia | yes | not-researched | — | yes | no | yes |
| Montenegro | yes | assessed-not-loadable | — | yes | no | yes |
| Morocco | yes | screened | ma-cnasnu | yes | yes | yes |
| Mozambique | yes | identified | — | yes | no | yes |
| Myanmar | yes | identified | — | yes | no | yes |
| Namibia | yes | assessed-not-loadable | — | yes | no | yes |
| Nauru | yes | not-researched | — | yes | no | yes |
| Nepal | yes | screened | np-moha-prohibited | yes | no | yes |
| Netherlands | yes | screened | nl-terror | yes | yes | yes |
| New Zealand | yes | screened | nz-mfat-russia, nz-terror | yes | yes | yes |
| Nicaragua | yes | assessed-not-loadable | — | yes | no | yes |
| Niger | yes | identified | — | yes | no | yes |
| Nigeria | yes | screened | ng-nigsac | yes | yes | yes |
| North Macedonia | yes | assessed-not-loadable | — | yes | no | yes |
| Norway | yes | assessed-not-loadable | — | yes | yes | yes |
| Oman | yes | identified | — | yes | yes | yes |
| Pakistan | yes | screened | pk-nacta | yes | yes | yes |
| Palau | yes | not-researched | — | yes | no | yes |
| Palestine | yes | identified | — | yes | no | yes |
| Panama | yes | assessed-not-loadable | — | yes | no | yes |
| Papua New Guinea | yes | assessed-not-loadable | — | yes | no | yes |
| Paraguay | yes | assessed-not-loadable | — | yes | no | yes |
| Peru | yes | assessed-not-loadable | — | yes | yes | yes |
| Philippines | yes | screened | ph-amlc | yes | yes | yes |
| Poland | yes | screened | pl-mswia-sanctions | yes | yes | yes |
| Portugal | yes | assessed-not-loadable | — | yes | yes | yes |
| Qatar | yes | screened | qa-nctc, qa-nctc-opensanctions | yes | yes | yes |
| Republic of Korea | yes | identified | — | yes | yes | yes |
| Romania | yes | screened | ro-onpcsb-terror | yes | yes | yes |
| Russia | yes | identified | — | yes | yes | yes |
| Rwanda | yes | identified | — | yes | no | yes |
| Saint Kitts and Nevis | yes | not-researched | — | yes | no | yes |
| Saint Lucia | yes | not-researched | — | yes | no | yes |
| Saint Vincent and the Grenadines | yes | not-researched | — | yes | no | yes |
| Samoa | yes | assessed-not-loadable | — | yes | no | yes |
| San Marino | yes | assessed-not-loadable | — | yes | no | yes |
| Sao Tome and Principe | yes | not-researched | — | yes | no | yes |
| Saudi Arabia | yes | screened | sa-pcct, sa-pcct-opensanctions | yes | yes | yes |
| Senegal | yes | assessed-not-loadable | — | yes | no | yes |
| Serbia | yes | screened | rs-apml-domestic | yes | yes | yes |
| Seychelles | yes | not-researched | — | yes | no | yes |
| Sierra Leone | yes | assessed-not-loadable | — | yes | no | yes |
| Singapore | yes | screened | sg-terrorists | yes | yes | yes |
| Slovakia | yes | assessed-not-loadable | — | yes | yes | yes |
| Slovenia | yes | assessed-not-loadable | — | yes | yes | yes |
| Solomon Islands | yes | assessed-not-loadable | — | yes | no | yes |
| Somalia | yes | screened | so-namlc | yes | no | yes |
| South Africa | yes | assessed-not-loadable | — | yes | yes | yes |
| South Sudan | yes | not-researched | — | yes | no | yes |
| Spain | yes | assessed-not-loadable | — | yes | yes | yes |
| Sri Lanka | yes | screened | lk-ca-1373 | yes | no | yes |
| Sudan | yes | not-researched | — | yes | no | yes |
| Suriname | yes | identified | — | yes | no | yes |
| Sweden | yes | assessed-not-loadable | — | yes | yes | yes |
| Switzerland | yes | screened | ch-seco, ch-seco-opensanctions | yes | yes | yes |
| Syria | yes | not-researched | — | yes | no | yes |
| Tajikistan | yes | identified | — | yes | no | yes |
| Tanzania | yes | identified | — | yes | no | yes |
| Thailand | yes | screened | th-designated | yes | yes | yes |
| Timor-Leste | yes | not-researched | — | yes | no | yes |
| Togo | yes | not-researched | — | yes | no | yes |
| Tonga | yes | not-researched | — | yes | no | yes |
| Trinidad and Tobago | yes | identified | — | yes | no | yes |
| Tunisia | yes | screened | tn-cnlct | yes | no | yes |
| Turkey | yes | screened | tr-masak, tr-wanted | yes | yes | yes |
| Turkmenistan | yes | assessed-not-loadable | — | yes | no | yes |
| Tuvalu | yes | not-researched | — | yes | no | yes |
| Uganda | yes | identified | — | yes | no | yes |
| Ukraine | yes | screened | ua-nsdc | yes | yes | yes |
| United Arab Emirates | yes | screened | internal-watchlist, uae-eocn-local-terrorist | yes | yes | yes |
| United Kingdom | yes | screened | uk-ofsi | yes | yes | yes |
| United States | yes | screened | ofac-consolidated, ofac-sdn, us-csl | yes | yes | yes |
| Uruguay | yes | assessed-not-loadable | — | yes | no | yes |
| Uzbekistan | yes | identified | — | yes | no | yes |
| Vanuatu | yes | not-researched | — | yes | no | yes |
| Venezuela | yes | not-researched | — | yes | no | yes |
| Vietnam | yes | identified | — | yes | yes | yes |
| Yemen | yes | not-researched | — | yes | no | yes |
| Zambia | yes | identified | — | yes | no | yes |
| Zimbabwe | yes | not-researched | — | yes | no | yes |

## Priority: FATF black/grey list countries (24)

| Country | FATF | Sanctions status | AM edition | Partial note |
|---|---|---|---|---|
| Democratic People's Republic of Korea | black | not-researched | no | yes |
| South Sudan | grey | not-researched | no | yes |
| Yemen | grey | not-researched | no | yes |
| Bosnia and Herzegovina | grey | identified | no |  |
| Iran | black | identified | no |  |
| Kuwait | grey | identified | yes |  |
| Myanmar | black | identified | no |  |
| Syria | grey | identified | no |  |
| Vietnam | grey | identified | yes |  |
| Angola | grey | assessed-not-loadable | no |  |
| Bolivia | grey | assessed-not-loadable | no |  |
| Cameroon | grey | assessed-not-loadable | no |  |
| Democratic Republic of the Congo | grey | assessed-not-loadable | no |  |
| Haiti | grey | assessed-not-loadable | no |  |
| Laos | grey | assessed-not-loadable | no |  |
| Papua New Guinea | grey | assessed-not-loadable | no |  |
| Venezuela | grey | assessed-not-loadable | no |  |
| Bulgaria | grey | screened | yes |  |
| Côte d'Ivoire | grey | screened | no |  |
| Iraq | grey | screened | yes |  |
| Kenya | grey | screened | yes |  |
| Lebanon | grey | screened | yes |  |
| Monaco | grey | screened | no |  |
| Nepal | grey | screened | no |  |

## Sanctions: 27 not researched (not FATF-flagged first)

| Country | AM edition | Partial note |
|---|---|---|
| Burundi | no | yes |
| Central African Republic | no | yes |
| Chad | no | yes |
| Comoros | no | yes |
| Congo | no | yes |
| Equatorial Guinea | no | yes |
| Eritrea | no | yes |
| Gabon | no | yes |
| Gambia | no | yes |
| Grenada | no | yes |
| Guinea | no | yes |
| Guinea-Bissau | no | yes |
| Kiribati | no | yes |
| Liberia | no | yes |
| Libya | no | yes |
| Mauritania | no | yes |
| Micronesia | no | yes |
| Nauru | no | yes |
| Saint Vincent and the Grenadines | no | yes |
| Sao Tome and Principe | no | yes |
| Sudan | no | yes |
| Timor-Leste | no | yes |
| Tonga | no | yes |
| Tuvalu | no | yes |

## Sanctions: list known but file not verified (37) and pending (2)

| Country | Status | AM edition |
|---|---|---|
| Belize | pending | no |
| Palestine | pending | no |
| Albania | identified | no |
| Algeria | identified | no |
| Armenia | identified | no |
| Bangladesh | identified | yes |
| Belarus | identified | no |
| Burkina Faso | identified | no |
| China | identified | yes |
| Cuba | identified | no |
| Ecuador | identified | no |
| Eswatini | identified | no |
| Ethiopia | identified | no |
| Greece | identified | yes |
| Guyana | identified | no |
| Holy See | identified | no |
| Hungary | identified | yes |
| Maldives | identified | no |
| Mali | identified | no |
| Mongolia | identified | no |
| Mozambique | identified | no |
| Niger | identified | no |
| Oman | identified | yes |
| Republic of Korea | identified | yes |
| Russia | identified | yes |
| Rwanda | identified | no |
| Suriname | identified | no |
| Tajikistan | identified | no |
| Tanzania | identified | no |
| Trinidad and Tobago | identified | no |
| Uganda | identified | no |
| Uzbekistan | identified | no |
| Zambia | identified | no |

## MLRO policy decision required (17)

| Country | Sanctions status | FATF |
|---|---|---|
| Yemen | not-researched | grey |
| Belarus | identified |  |
| Burkina Faso | identified |  |
| China | identified |  |
| Cuba | identified |  |
| Eswatini | identified |  |
| Ethiopia | identified |  |
| Iran | identified | black |
| Mali | identified |  |
| Myanmar | identified | black |
| Niger | identified |  |
| Russia | identified |  |
| Rwanda | identified |  |
| Syria | identified | grey |
| Tajikistan | identified |  |
| Uzbekistan | identified |  |
| Vietnam | identified | grey |

## Adverse media: 128 countries with no dedicated Google News edition

Afghanistan, Albania, Algeria, Andorra, Angola, Antigua and Barbuda, Armenia, Azerbaijan, Bahamas, Barbados, Belarus, Belize, Benin, Bhutan, Bolivia, Bosnia and Herzegovina, Botswana, Brunei, Burkina Faso, Burundi, Cabo Verde, Cambodia, Cameroon, Central African Republic, Chad, Comoros, Congo, Costa Rica, Côte d'Ivoire, Croatia, Cuba, Cyprus, Democratic People's Republic of Korea, Democratic Republic of the Congo, Denmark, Djibouti, Dominica, Dominican Republic, Ecuador, El Salvador, Equatorial Guinea, Eritrea, Eswatini, Ethiopia, Fiji, Gabon, Gambia, Georgia, Grenada, Guatemala, Guinea, Guinea-Bissau, Guyana, Haiti, Holy See, Honduras, Iceland, Iran, Jamaica, Kazakhstan, Kiribati, Kyrgyzstan, Laos, Lesotho, Liberia, Libya, Liechtenstein, Luxembourg, Madagascar, Malawi, Maldives, Mali, Malta, Marshall Islands, Mauritania, Mauritius, Micronesia, Moldova, Monaco, Mongolia, Montenegro, Mozambique, Myanmar, Namibia, Nauru, Nepal, Nicaragua, Niger, North Macedonia, Palau, Palestine, Panama, Papua New Guinea, Paraguay, Rwanda, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines, Samoa, San Marino, Sao Tome and Principe, Senegal, Seychelles, Sierra Leone, Solomon Islands, Somalia, South Sudan, Sri Lanka, Sudan, Suriname, Syria, Tajikistan, Tanzania, Timor-Leste, Togo, Tonga, Trinidad and Tobago, Tunisia, Turkmenistan, Tuvalu, Uganda, Uruguay, Uzbekistan, Vanuatu, Venezuela, Yemen, Zambia, Zimbabwe

## Worldwide PEP screening scope: 195/195 countries

The configured worldwide PEP screen applies across the full 195-country subject universe. This is an applicability measure, not proof that the source contains every PEP or that every country has complete identity data.

No countries are outside the configured PEP scope.

Runtime assurance separately checks the harvested artifact, freshness, completeness, source-quality exceptions and whether the daily screen consumed that exact artifact.

## Regeneration

Run `npm run coverage:report` to print this report, `npm run coverage:report:write` to refresh it, or `npm run coverage:report:check` to fail on drift.
