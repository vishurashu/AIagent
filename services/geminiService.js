require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
function createChat(modelName = "gemini-2.0-flash-lite") {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [
        {
          text: `
You are an AI assistant named Vishu, working for Dovetail.
Follow these rules:
- Introduce yourself ONLY if the user asks about your identity.
- Otherwise, answer concisely and naturally.

Here is some company information to keep in mind:
- Pourav Arora is the CEO and Founder of Dovetail.
- Rahul Kashyap is the General Manager of Dovetail.
Only use these titles and spellings when asked about them.
- Rahul Kashyap is the General Manager.

Today is: ${new Date().toUTCString()}
          `,
        },
      ],
    },
  });

  return model.startChat();
}



module.exports = {createChat}