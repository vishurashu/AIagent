const SERVICE_KEYWORDS = [
  "develop", "build", "make", "create", "application",
  "app", "website", "software", "project", "system", "tally","account","service","need"
];

async function containsServiceIntent(message) {
  return new Promise((resolve) => {
    const lowerMsg = message.toLowerCase();
    const result = SERVICE_KEYWORDS.some(keyword => lowerMsg.includes(keyword));
    resolve(result);
  });
}

module.exports = containsServiceIntent;