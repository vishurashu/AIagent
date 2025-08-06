const GENERAL_QUESTION_PATTERNS = [
  /^(what|who|how|why|where|tell|explain|do you)\b/i,
  /\?$/,
  /^(is|are|can|could|would|will|when)\b/i
];

class ContactFlow {
  constructor(socket) {
    this.socket = socket;
    this.reset();
    this.hasSubmitted = false; // ✅ Prevent re-start after submission
  }

  reset() {
    this.step = null;
    this.data = {};
    this.isActive = false;
  }

  async handleMessage(msg) {
    // ✅ Allow user to restart if they type "restart" or "update"
    if (msg.toLowerCase().includes("restart") || msg.toLowerCase().includes("update")) {
      this.hasSubmitted = false;
      this.start();
      return true;
    }

    if (this.shouldExitFlow(msg)) {
      this.socket.emit("botMessage", "Sure! Let me answer your question first.");
      this.reset();
      return false;
    }

    switch (this.step) {
      case "askName": return this.handleName(msg);
      case "askEmail": return this.handleEmail(msg);
      case "askPhone": return this.handlePhone(msg);
      case "askComments": return this.handleComments(msg);
      default: return false;
    }
  }

  shouldExitFlow(msg) {
    return GENERAL_QUESTION_PATTERNS.some(pattern => pattern.test(msg)) ||
           msg.toLowerCase().includes("cancel");
  }

  handleName(msg) {
    this.data.name = msg;
    this.step = "askEmail";
    this.socket.emit("botMessage", "Thanks! What's your email address?");
    return true;
  }

  handleEmail(msg) {
    if (!this.validateEmail(msg)) {
      this.socket.emit("botMessage", "❌ Please enter a valid email address");
      return true;
    }

    this.data.email = msg;
    this.step = "askPhone";
    this.socket.emit("botMessage", "Got it. What's your phone number?");
    return true;
  }

  handlePhone(msg) {
    const digits = msg.replace(/\D/g, '');
    if (digits.length < 7) {
      this.socket.emit("botMessage", "❌ Please enter a valid phone number");
      return true;
    }

    this.data.phone = digits;
    this.step = "askComments";
    this.socket.emit("botMessage", "Almost done! Briefly describe your project needs.");
    return true;
  }

  async handleComments(msg) {
    this.data.comments = msg;

    try {
      await this.submitContactDetails();
      this.hasSubmitted = true; // ✅ Mark as submitted
      this.socket.emit("botMessage", "✅ Submitted successfully! We'll contact you soon.");
    } catch (error) {
      console.error("Submission Error:", error);
      this.socket.emit("botMessage", "⚠️ Failed to submit. Please try again later.");
    }

    this.reset();
    return true;
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async submitContactDetails() {
    const payload = {
      category: "CONTACT PAGE",
      ...this.data
    };

    const response = await fetch("https://dovetailsolutions.in/contactdetails.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  start() {
    if (this.hasSubmitted) {
      // ✅ Do NOT restart if already submitted
      this.socket.emit("botMessage", "You have already submitted your details. Type 'restart' if you want to update.");
      return;
    }

    this.step = "askName";
    this.isActive = true;
    this.socket.emit("botMessage", "Great! Let's get some details:\nWhat's your name?");
  }
}

module.exports = ContactFlow;
