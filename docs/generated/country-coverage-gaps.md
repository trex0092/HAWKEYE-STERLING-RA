# HAWKEYE-STERLING-RA: country coverage gaps (195 countries)

Generated from `data/sanctions-country-coverage.json` and the `LOCALES` matrix in `scripts/adverse-media.mjs`. Register updated: 2026-10-08.

## How to read this

- **Sanctions status** is the register's own status. `not-researched` = no outcome recorded (27). `identified` = list known, file not verified (38). `pending` = candidate recorded, not loaded (1). `assessed-not-loadable` = researched, cannot be loaded (75). `screened` = national list loaded (54).
- **AM edition** = whether a dedicated Google News country edition exists in the adverse-media matrix. `no` does not mean zero adverse-media coverage: GDELT and Bing News sweeps are global and name-scoped.
- **Partial note** = a not-researched country that already has a partial research note in the register.
- **PEP** is intentionally omitted per country because the current PEP artifact's country field is not reliable enough for a defensible country-by-country statement.
- UN consolidated list screening is independent of these national-list statuses.

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

## Sanctions: list known but file not verified (38) and pending (1)

| Country | Status | AM edition |
|---|---|---|
| Belize | pending | no |
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
| Palestine | identified | no |
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

## Regeneration

Run `npm run coverage:report` to print this report, `npm run coverage:report:write` to refresh it, or `npm run coverage:report:check` to fail on drift.
