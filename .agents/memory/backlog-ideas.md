---
type: project
created: 2026-08-26
updated: 2026-08-26
---

# Backlog Ideas

## Voice Dictation for Treatment Planning
- **Goal:** Allow the user to use voice dictation natively in the app to create treatment plans (orçamentos).
- **Mechanism:** Add a microphone button in the CRM/Planejamento interface. Use Web Speech API (SpeechRecognition) to capture voice input (e.g., "Dente 16 oclusal, restauração em resina").
- **Processing:** Send the transcribed text to the Gemini API (which is already integrated in the app) to extract structured data (tooth number, faces, procedure name).
- **Action:** Automatically populate the planning list with the extracted procedures, looking up prices from the system's database. If a price/procedure is missing, flag it for the user to add the value. Generate the PDF automatically.
- **Manual override:** User can still optionally upload photos and drag markers on the odontogram if desired, but it's not strictly required.
