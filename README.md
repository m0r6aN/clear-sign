# 📝 ClearSign - AI Contract Analyzer

**Understand what you sign.**

ClearSign is an AI-powered legal assistant that translates dense legal contracts into plain English, highlights key obligations, and flags potential risks before you sign. Powered by the Google Gemini API, it provides a fast, interactive way to review `.txt`, `.docx`, and even physically scanned documents.

## ✨ Features

*   **📄 Seamless Import:** Drag-and-drop `.txt` or `.docx` files, paste text directly, or upload documents from your computer.
*   **📸 Camera Scanning Integration:** Use your device's camera to scan physical contracts. ClearSign uses advanced AI vision to extract text exactly as it appears on the page.
*   **🎯 Executive Summary:** Instantly get a plain-English overview of the contract’s purpose and terms.
*   **🚨 Automated Risk Detection:** Identifies "Red Flags" and assigns them a severity level (High, Medium, Low).
*   **✅ Obligation Tracking:** Clearly lists who is responsible for what within the agreement.
*   **💬 Interactive Q&A ("Ask AI"):** Select specific clauses or red flags and open the Q&A modal to ask follow-up questions. The AI will answer interactively based directly on the context of the contract.
*   **🌗 Dark Mode:** Built-in theme toggling for comfortable reading in any environment.
*   **📤 Export, Share & Print:** Easily print your summarized analysis or share it via native system sharing tools.

## 🎯 Use Cases

*   **Freelancers & Contractors:** Quickly review Statements of Work (SOWs), Independent Contractor Agreements, and NDAs to ensure fair terms and flag unusual IP (Intellectual Property) clauses.
*   **Tenants & Renters:** Scan lease agreements to uncover hidden fees, early termination penalties, and confusing maintenance responsibilities.
*   **Employees:** Demystify employment contracts, non-compete clauses, and severance agreements before accepting a new job offer.
*   **Small Business Owners:** Analyze vendor contracts, software terms of service, and partnership agreements to understand obligations without immediate reliance on costly legal counsel.
*   **Consumers:** Break down lengthy Terms and Conditions or End User License Agreements (EULAs) for everyday apps and services.

## 🛠 Tech Stack

*   **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
*   **AI Engine:** Google Gemini API (`gemini-3.1-pro-preview`)
*   **Document Parsing:** `mammoth` (for `.docx` extraction)
*   **UI Components:** `lucide-react` for icons, `react-markdown` for Q&A chat formatting

## 🚀 Getting Started

To run ClearSign locally:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env` file in the root directory and add your Google Gemini API Key:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```

## ⚠️ Disclaimer

*ClearSign is an AI-powered tool designed for educational and informational purposes to aid in preliminary document review. It does not constitute official legal advice, nor does it create an attorney-client relationship. Always consult with a qualified attorney for binding or high-stakes legal decisions.*
