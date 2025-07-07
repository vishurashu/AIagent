require("dotenv").config();
const expenseDB = []
const { GoogleGenerativeAI } = require("@google/generative-ai");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

// Initialize readline
const rl = readline.createInterface({ input, output });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "AIzaSyAeAmRopF3WW7JlXi9ua5n8Kkpji75rP1E"
);

// Local weather function
function getWetherTemp(city = "") {
  const lowerCaseCity = city.toLowerCase();
  if (lowerCaseCity === "patiala") return "10°C";
  if (lowerCaseCity === "amritsar") return "12°C";
  if (lowerCaseCity === "mohali") return "11°C";
  if (lowerCaseCity === "delhi") return "15°C";
  if (lowerCaseCity === "banglore" || lowerCaseCity === "bengaluru")
    return "25°C";
  return "N/A";
}

// Expense function
function getTotalExpense({ from, to }) {
  console.log(`Fetching expenses from ${from} to ${to}`);

  const expense = expenseDB.reduce((acc,item)=>{
      return (acc+item.amount)
  },0)
  return expense;
}

// add expense function 


function addExpense({ name, amount }) {
  expenseDB.push({ name, amount });
  return "Expense added.";
}

async function main() {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: {
      parts: [
        {
          text:
            "You are an AI assistant named Vishu. When asked about your identity, " +
            "always respond with: 'I am Dovetail assistant, how can I help you?' " +
            "For weather queries, use the getWetherTemp function. For expense queries, use getTotalExpense. " +
            `Current dateTime: ${new Date().toUTCString()}`,
        },
      ],
      role: "system",
    },
    tools: [
      {
        functionDeclarations: [
          {
            name: "getWetherTemp",
            description: "Gets the current weather temperature for a given city",
            parameters: {
              type: "OBJECT",
              properties: {
                city: {
                  type: "STRING",
                  description: "The name of the city (e.g., 'Patiala', 'Delhi')",
                },
              },
              required: ["city"],
            },
          },
          {
            name: "getTotalExpense",
            description: "Gets total expenses between dates",
            parameters: {
              type: "OBJECT",
              properties: {
                from: {
                  type: "STRING",
                  description: "Start date (YYYY-MM-DD)",
                },
                to: {
                  type: "STRING",
                  description: "End date (YYYY-MM-DD)",
                },
              },
              required: ["from", "to"],
            },
          },
        {
  name: "addExpense",
  description: "Add new expense entry to the expense database",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the expense, e.g., 'Bought an iPhone'",
      },
      amount: {
        type: "string",
        description: "Amount of the expense",
      },
    },
    required: ["name", "amount"],
  },
}

        ],
      },
    ],
  });

  const chat = model.startChat();

  while (true) {
    const userInput = await rl.question("USER: ");
    if (userInput.toLowerCase() === "bye") {
      console.log("Assistant: Goodbye! Have a great day.");
      break;
    }

    try {
      const result = await chat.sendMessage(userInput);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        console.log("Gemini requested to call functions:");

        const functionResponses = [];

        for (const call of functionCalls) {
          console.log(`- Function name: ${call.name}`);
          console.log(`- Arguments: ${JSON.stringify(call.args)}`);

          if (call.name === "getWetherTemp") {
            const temperature = getWetherTemp(call.args.city);
            functionResponses.push({
              functionResponse: {
                name: "getWetherTemp",
                response: { temperature },
              },
            });
          } else if (call.name === "getTotalExpense") {
            const total = getTotalExpense(call.args);
            functionResponses.push({
              functionResponse: {
                name: "getTotalExpense",
                response: { total },
              },
            });
        } else if (call.name === "addExpense") {
  const expense = addExpense(call.args);
  functionResponses.push({
    functionResponse: {
      name: "addExpense",
      response: { expense },
    }
  });
}
 else {
            console.log("Unknown function requested by Gemini:", call.name);
          }
        }

        // Send all function responses at once
        const toolResult = await chat.sendMessage(functionResponses);
        console.log("Assistant:", toolResult.response.text());
      } else {
        // Direct Gemini response (no tool usage)
        console.log("Assistant:", response.text());
      }
    } catch (err) {
      console.error("Error during chat:", err);
    }
  }

  rl.close();
}

main().catch(console.error);
