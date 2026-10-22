// Narration script: the single source for spoken lines, captions (SRT) and narration.md.
// `text` is what the viewer reads as a caption; `say` (optional) is a pronunciation hint for the speech engine only.
// Scenes are recorded in order; the sim scene's pacing follows each line's spoken length.
export const scenes = [
  { id: "hook", title: "Hook", segs: [
    { id: "hook1", text: "One family, one weekend. A parent can't drive Saturday morning, and rain is coming." },
    { id: "hook2", text: "That one change ripples through a ride, a refill and dinner. THREAD keeps every commitment alive." },
  ] },
  { id: "boot", title: "One command", segs: [
    { id: "boot1", text: "One command, npm run demo, starts everything." },
  ] },
  { id: "sim", title: "The simulation", segs: [
    { id: "sim1", text: "This is our simulated Alexa+ experience: an Echo Show for Maya, a phone for Sam. Real MCP clients, real server." },
    { id: "sim2", text: "Maya asks what's on this weekend." },
    { id: "sim3", text: "She can't drive Saturday morning. What does this change affect? The tournament and the refill. Dinner is fine." },
    { id: "sim4", text: "Under the hood, a real JSON-RPC call: POST slash mcp, tools call, report change." },
    { id: "sim5", text: "Maya asks Sam to take the ride. THREAD shares only what Sam needs, and labels what it withheld." },
    { id: "sim6", text: "On Sam's phone, signed in with his own OAuth token, he accepts. The plan is secured, not done." },
    { id: "sim7", text: "For the refill, THREAD offers pharmacy delivery. Nothing is ordered until Maya approves." },
    { id: "sim8", text: "She approves. The pharmacy is simulated; nothing is really ordered." },
    { id: "sim9", text: "Saturday: rain moves the departure." },
    { id: "sim10", text: "Sam arrives and says so, and only then does the tournament resolve." },
  ] },
  { id: "inspector", title: "Inspector proof", segs: [
    { id: "ins1", text: "Proof it's real: the official MCP Inspector, against the same server." },
    { id: "ins2", text: "Initialize negotiates protocol 2025-11-25." },
    { id: "ins3", text: "Exactly eight tools." },
    { id: "ins4", text: "And a real tool call, returning the ripple." },
  ] },
  { id: "auth", title: "OAuth checks", segs: [
    { id: "auth1", text: "OAuth is enforced: no token, 401. A service token can list tools, never call them. And Maya can't answer Sam's handoff." },
  ] },
  { id: "code", title: "Code tour", segs: [
    { id: "code1", text: "The official MCP SDK, with Streamable HTTP." },
    { id: "code2", text: "Tool schemas come straight from thread-core." },
    { id: "code3", text: "The simulator's own MCP client." },
    { id: "code4", text: "And the Agent Skill that says when to call each tool." },
  ] },
  { id: "arch", title: "Architecture", segs: [
    { id: "arch1", text: "The simulator calls a Hono MCP server with OAuth, over thread-core, our open-source engine, and simulated connectors." },
  ] },
  { id: "cdk", title: "AWS CDK stack", segs: [
    { id: "arch2", text: "The AWS stack is a CDK app: Lambda, DynamoDB, Bedrock access. Deployment-ready, synthesized, not deployed." },
  ] },
  { id: "honest", title: "Real versus simulated", segs: [
    { id: "arch3", text: "Real versus simulated: the server, OAuth and engine are real. The Alexa+ device and the connectors are simulated." },
    { id: "arch4", text: "thread-core is Apache 2.0, with a published release." },
  ] },
  { id: "close", title: "Close", segs: [
    { id: "close1", text: "Something changes. THREAD knows what it affects, moves the responsibility, protects the context, and stays until it's done." },
    { id: "close2", text: "Built with Kiro, ready for AWS." },
  ] },
];

// Speech-engine pronunciation hints (caption text is never altered).
const say = [
  [/Alexa\+/g, "Alexa plus"], [/\bMCP\b/g, "M C P"], [/\bnpm\b/g, "N P M"], [/\bOAuth\b/g, "Oh Auth"],
  [/JSON-RPC/g, "JSON R P C"], [/\bPOST\b/g, "post"], [/slash mcp/g, "slash M C P"],
  [/\b401\b/g, "four oh one"], [/2025-11-25/g, "twenty twenty five, eleven, twenty five"],
  [/thread-core/g, "thread core"], [/Apache 2\.0/g, "Apache two point oh"], [/\bAWS\b/g, "A W S"], [/\bCDK\b/g, "C D K"],
  [/\bHono\b/g, "Hono"], [/DynamoDB/g, "Dynamo D B"], [/\bKiro\b/g, "Kee-ro"], [/\bAPI\b/g, "A P I"],
];
export const spoken = (seg) => seg.say ?? say.reduce((t, [re, to]) => t.replace(re, to), seg.text);
