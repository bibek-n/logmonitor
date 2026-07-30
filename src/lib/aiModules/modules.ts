import type OpenAI from "openai";
import { TOOL_HANDLERS as ASSISTANT_HANDLERS, TOOL_DEFINITIONS as ASSISTANT_DEFINITIONS } from "@/lib/aiAssistant/tools";
import { EXTRA_TOOL_HANDLERS, EXTRA_TOOL_DEFINITIONS } from "./extraTools";
import type { ToolHandler } from "./shared";

// Registry for the 6 AI Modules (Root Cause Analysis, Alert Correlation, AI Incident Summary,
// AI Log Analyzer, AI Configuration Review, AI Threat Detection). Each is really the same
// tool-calling infrastructure as the AI Assistant, aimed at a curated subset of tools with a
// system prompt specialized for that module's analytical angle - not 6 separate integrations.
// Reuses the AI Assistant's existing 22 read-only tools wherever they already cover the need,
// and adds only the handful of new ones (device-specific/log/config lookups) in extraTools.ts.

const ALL_HANDLERS: Record<string, ToolHandler> = { ...ASSISTANT_HANDLERS, ...EXTRA_TOOL_HANDLERS };
const ALL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [...ASSISTANT_DEFINITIONS, ...EXTRA_TOOL_DEFINITIONS];

function pickTools(names: string[]) {
  const handlers: Record<string, ToolHandler> = {};
  for (const name of names) {
    const handler = ALL_HANDLERS[name];
    if (!handler) throw new Error(`AI module tool registry error: unknown tool "${name}"`);
    handlers[name] = handler;
  }
  const definitions = ALL_DEFINITIONS.filter((d) => d.type === "function" && names.includes(d.function.name));
  return { handlers, definitions };
}

export interface AiModuleDef {
  key: string;
  label: string;
  description: string;
  systemPrompt: string;
  exampleQuestions: string[];
  toolHandlers: Record<string, ToolHandler>;
  toolDefinitions: OpenAI.Chat.ChatCompletionTool[];
}

function defineModule(config: Omit<AiModuleDef, "toolHandlers" | "toolDefinitions"> & { toolNames: string[] }): AiModuleDef {
  const { toolNames, ...rest } = config;
  const { handlers, definitions } = pickTools(toolNames);
  return { ...rest, toolHandlers: handlers, toolDefinitions: definitions };
}

export const AI_MODULES: Record<string, AiModuleDef> = {
  rootCauseAnalysis: defineModule({
    key: "rootCauseAnalysis",
    label: "Root Cause Analysis",
    description: "Diagnose why something happened - an outage, a slowdown, a failure - using this dashboard's own monitoring data.",
    systemPrompt: `You are the Root Cause Analysis module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
Given a description of a problem (an outage, a slowdown, an error, an alert), use the provided tools to gather evidence and propose the most likely root cause(s).
ONLY use data returned by the tools - never guess or invent numbers, device names, or timestamps. If the tools don't return enough evidence to pinpoint a cause, say so plainly and list what you checked.
Prefer specific, falsifiable explanations over generic ones (e.g. "CPU spiked to 98% at 14:32, correlating with a reboot at 14:33" rather than "the server was under load").
Check get_recent_admin_actions when relevant - a recent config/deployment change is often the actual root cause.
Keep the answer structured: a short "Likely cause" statement first, then the supporting evidence, then a recommended next step.`,
    exampleQuestions: [
      "Why did the router's bandwidth spike last night?",
      "Why is the SQL Server instance showing as unhealthy?",
      "What might be causing high CPU on the LogMonitor server?",
    ],
    toolNames: [
      "get_offline_devices",
      "get_bandwidth_summary",
      "get_intrusion_alerts",
      "get_sophos_threats",
      "get_website_performance_alerts",
      "get_sql_instance_health",
      "get_disk_health_issues",
      "get_router_health",
      "get_recent_admin_actions",
      "get_device_metrics_history",
      "get_server_logs",
    ],
  }),

  alertCorrelation: defineModule({
    key: "alertCorrelation",
    label: "Alert Correlation",
    description: "Find related alerts across different monitoring systems and group them by likely shared cause.",
    systemPrompt: `You are the Alert Correlation module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
This app has no single unified alert table - alerts live separately across intrusion detection, the Sophos firewall, malware scans, the threat scanner, website performance, SQL Server monitoring, and disk health.
Your job: pull the relevant alert sources with the provided tools, then group alerts that likely share a root cause (same device, same IP/host, same time window) into clusters, and explain the likely connection for each cluster.
ONLY use data returned by the tools - never invent alerts, IPs, or timestamps. If two alerts don't share any evident connection, don't force a correlation - report them separately.
Order clusters by apparent severity/urgency. For each cluster, state: what's in it, why you grouped it, and what it likely means together that it wouldn't mean alone.`,
    exampleQuestions: [
      "Correlate all active alerts from the last 24 hours.",
      "Are today's intrusion detection alerts related to any device or SQL issues?",
      "Group this week's security and performance alerts by likely cause.",
    ],
    toolNames: [
      "get_offline_devices",
      "get_intrusion_alerts",
      "get_sophos_threats",
      "get_malware_findings",
      "get_threat_scanner_results",
      "get_website_performance_alerts",
      "get_sql_instance_health",
      "get_disk_health_issues",
    ],
  }),

  aiIncidentSummary: defineModule({
    key: "aiIncidentSummary",
    label: "AI Incident Summary",
    description: "Turn raw monitoring data into a clear, shareable written summary of an incident - what happened, impact, and current status.",
    systemPrompt: `You are the AI Incident Summary module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
Given a topic (a device, a time period, or a described incident), use the provided tools to gather the facts, then write a concise incident summary suitable for pasting into a ticket, status report, or stakeholder email.
ONLY use data returned by the tools - never invent facts, numbers, or timestamps not present in the tool output.
Structure the summary as: a one-line headline, a "What happened" section (factual, chronological if timestamps are available), an "Impact" section, and a "Current status" section (resolved/ongoing/monitoring).
Write in plain, professional language for a non-technical stakeholder audience - avoid raw jargon like table/column names.`,
    exampleQuestions: [
      "Write an incident summary for the outage on the router today.",
      "Summarize this week's malware findings for a report.",
      "Give me a status update on active intrusion detection alerts.",
    ],
    toolNames: [
      "get_offline_devices",
      "get_intrusion_alerts",
      "get_sophos_threats",
      "get_malware_findings",
      "get_website_performance_alerts",
      "get_sql_instance_health",
      "get_recent_admin_actions",
      "get_device_metrics_history",
    ],
  }),

  aiLogAnalyzer: defineModule({
    key: "aiLogAnalyzer",
    label: "AI Log Analyzer",
    description: "Read raw server logs (nginx, apache, mysql, php, system, event log) for a device and surface errors, anomalies, and patterns worth attention.",
    systemPrompt: `You are the AI Log Analyzer module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
Given a device name and (optionally) a log source or time window, use get_server_logs to pull raw log entries and analyze them for errors, warnings, repeated patterns, or anything unusual.
ONLY use data returned by the tools - never invent log lines or error messages. If get_server_logs returns no data, say so plainly rather than fabricating findings.
Group repeated/similar messages together with a count rather than listing every duplicate individually. Call out anything that looks like a genuine problem (errors, failed connections, permission issues, crashes) distinctly from routine/informational entries.
If the device name is ambiguous or not found, ask the user to confirm the exact device name rather than guessing.`,
    exampleQuestions: [
      "Any errors in the LogMonitor server's logs today?",
      "Summarize recent PHP errors on the Laravel-Dev server.",
      "Check the Windows event log on tulips.tulipstechnologies.com for anything unusual this week.",
    ],
    toolNames: ["get_server_logs", "get_offline_devices", "get_disk_health_issues"],
  }),

  aiConfigurationReview: defineModule({
    key: "aiConfigurationReview",
    label: "AI Configuration Review",
    description: "Review a website's or device's security-relevant configuration and get prioritized recommendations.",
    systemPrompt: `You are the AI Configuration Review module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
Given a website or device name, use the provided tools to pull its current configuration/security posture (HTTP security headers, endpoint antivirus/firewall/BitLocker/TPM status, open network ports, code-quality/Laravel-security scan issues) and review it.
ONLY use data returned by the tools - never invent configuration values or issues not present in the tool output.
Give a short prioritized list of concrete recommendations (most important first), each tied to a specific finding from the tools - not generic security advice. If everything checked looks fine, say so plainly rather than inventing a recommendation to fill space.`,
    exampleQuestions: [
      "Review the security configuration of tulipshrm.com.",
      "Is the LogMonitor server's endpoint security posture OK?",
      "What ports are exposed on the Laravel-Dev server, and is that a problem?",
    ],
    toolNames: [
      "get_security_header_issues",
      "get_device_security_status",
      "get_device_network_info",
      "get_code_quality_issues",
      "get_laravel_security_issues",
    ],
  }),

  aiThreatDetection: defineModule({
    key: "aiThreatDetection",
    label: "AI Threat Detection",
    description: "Behavioral, pattern-based threat hunting across recent security data - a second opinion alongside the signature/reputation-based Threat Scanner and Malware Detection features.",
    systemPrompt: `You are the AI Threat Detection module inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
This is deliberately different from the app's existing Threat Scanner (VirusTotal reputation lookups) and Malware Detection (signature-based file scanning) - your job is to look for BEHAVIORAL and PATTERN-based signals across recent security data that a rule-based scanner could miss: unusual web-filter activity spikes, correlated intrusion/firewall events, odd access patterns.
Use the provided tools to gather recent security-relevant data, then report anything that looks suspicious with your reasoning for why it's suspicious - never invent an IP, domain, or event not present in tool output.
If nothing unusual is found, say so plainly rather than manufacturing a finding. Rate anything you do flag as Low/Medium/High concern and explain what a human should check next.`,
    exampleQuestions: [
      "Anything suspicious in the last 24 hours?",
      "Are there unusual web filter patterns today?",
      "Cross-reference recent intrusion alerts with Sophos threat logs for a pattern.",
    ],
    toolNames: [
      "get_intrusion_alerts",
      "get_sophos_threats",
      "get_malware_findings",
      "get_threat_scanner_results",
      "get_staff_status",
      "get_recent_web_filter_activity",
    ],
  }),
};

export function getAiModule(key: string): AiModuleDef | null {
  return AI_MODULES[key] ?? null;
}
