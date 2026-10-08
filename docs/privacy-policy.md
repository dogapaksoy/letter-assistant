# Privacy policy (DRAFT)

> **Draft, not reviewed by a lawyer.** It describes what the code in this repository does as of October 2026. Before publishing: fill in the placeholders, name the OCR and LLM providers that are actually used, have it reviewed (GDPR/DSGVO), and provide German, Turkish and English versions. Update it whenever data handling changes.

## Who is responsible

[Name, address, e-mail of the controller]. [Data protection officer, if required.]

## What the app does

Letter Assistant helps you understand official German letters. It is a comprehension aid, not legal advice.

## What data is processed, and for how long

| Data                                                      | Why                                           | Where                                                                                    | How long                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Photo or PDF of your letter                               | To read the text                              | Sent over an encrypted connection to our server in the EU (Supabase, Frankfurt, Germany) | Only while your request is processed. It is **not stored**.                                                                                                                                                                                                                                             |
| Text of your letter                                       | To create the summary, deadlines and actions  | Our server, and the AI service named below                                               | Only while your request is processed. It is **not stored** by us. Retention by the AI service: [see provider terms; must be no-training, EU processing].                                                                                                                                                |
| Results (summary, deadlines, actions) and the letter text | To show them to you                           | Only on your phone, in the app's memory                                                  | Until you start a new letter or close the app.                                                                                                                                                                                                                                                          |
| Your corrections (the text you type)                      | To show your correction next to the item      | Only on your phone                                                                       | Until you start a new letter or close the app.                                                                                                                                                                                                                                                          |
| Error reports ("Wrong?")                                  | To measure and improve the quality of the app | Our database (Supabase, Frankfurt)                                                       | [Retention period, e.g. 24 months]. A report contains only the type of error (e.g. "wrong date"), whether the item was found in the letter, the confidence level, the language, and technical versions. **It contains no letter content, no name, no address and no identifier of you or your device.** |
| Language setting                                          | To remember your language                     | Only on your phone                                                                       | Until you uninstall the app.                                                                                                                                                                                                                                                                            |
| Calendar entries                                          | Only if you choose "Add to calendar"          | Your phone's calendar app, via the system dialog                                         | Under your control.                                                                                                                                                                                                                                                                                     |

We do not create accounts, we do not use advertising or tracking, and we do not log the contents of letters, names, addresses, tax IDs, IBANs or other personal data.

## Service providers (processors)

- **Supabase** (hosting of the server function and database), region Central EU (Frankfurt). [DPA reference.]
- **Text recognition (OCR)**: [provider, region, DPA, no-training/retention terms].
- **AI language model**: [provider, region, DPA; must not use submitted data for training].

## Legal basis

[To be completed with legal advice, e.g. Art. 6(1)(b) GDPR for providing the service you request; Art. 6(1)(f) for anonymous quality reports. Letters can contain special categories of data (e.g. health insurance); assess Art. 9.]

## Your rights

You have the right to access, rectification, erasure, restriction, objection and data portability, and to lodge a complaint with a supervisory authority. Because we do not store your letters or link reports to you, we generally hold no data that identifies you. Contact: [e-mail].

## Changes

[Date of this version.]
