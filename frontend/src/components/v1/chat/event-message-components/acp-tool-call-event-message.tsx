import React from "react";
import { useTranslation } from "react-i18next";
import CheckCircle from "#/icons/check-circle-solid.svg?react";
import { ACPToolCallEvent } from "#/types/v1/core/events/acp-tool-call-event";
import { GenericEventMessage } from "#/components/features/chat/generic-event-message";
import { I18nKey } from "#/i18n/declaration";

interface ACPToolCallEventMessageProps {
  event: ACPToolCallEvent;
}

const MAX_OUTPUT_PREVIEW = 2000;
const SUMMARY_LINES = 2;

/**
 * True if the tool call should be rendered with error styling — either the
 * SDK-reported ``is_error`` flag or a terminal ``failed`` status.
 */
const hasError = (event: ACPToolCallEvent): boolean =>
  event.is_error || event.status === "failed";

/**
 * Formats a summary line for the raw output: first 2 non-empty lines, or
 * a byte count when the payload is huge / structured.
 */
const summarizeOutput = (rawOutput: unknown): string | null => {
  if (rawOutput === null || rawOutput === undefined || rawOutput === "") {
    return null;
  }

  if (typeof rawOutput === "string") {
    const lines = rawOutput.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const preview = lines.slice(0, SUMMARY_LINES).join(" \u2026 ");
    if (preview.length > 160) {
      return `${preview.slice(0, 157)}...`;
    }
    return preview;
  }

  try {
    const json = JSON.stringify(rawOutput);
    const byteLen = new TextEncoder().encode(json).length;
    return `${byteLen} bytes`;
  } catch {
    return null;
  }
};

/**
 * Renders ``raw_input`` for an ACP tool call. Picks a specialised view per
 * ``tool_kind`` (execute ⇒ command, edit ⇒ path, read ⇒ path+range) and
 * falls back to pretty-printed JSON.
 */
function ToolCallInputView({ event }: { event: ACPToolCallEvent }) {
  const { t } = useTranslation();
  const input = event.raw_input as Record<string, unknown> | null | undefined;

  if (
    event.tool_kind === "execute" &&
    input &&
    typeof input.command === "string"
  ) {
    return (
      <pre className="text-xs bg-neutral-800 p-2 rounded overflow-x-auto font-mono text-neutral-200 whitespace-pre-wrap">
        {input.command}
      </pre>
    );
  }

  if (event.tool_kind === "edit" && input && typeof input.path === "string") {
    const content = typeof input.content === "string" ? input.content : null;
    return (
      <div className="flex flex-col gap-2">
        <code className="text-xs bg-neutral-800 px-2 py-1 rounded self-start">
          {input.path}
        </code>
        {content && (
          <pre className="text-xs bg-neutral-800 p-2 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </div>
    );
  }

  if (event.tool_kind === "read" && input && typeof input.path === "string") {
    const from = typeof input.offset === "number" ? input.offset : null;
    const lineCount = typeof input.limit === "number" ? input.limit : null;
    let range = "";
    if (from !== null && lineCount !== null) {
      range = `:${from}-${from + lineCount}`;
    } else if (from !== null) {
      range = `:${from}`;
    }
    return (
      <code className="text-xs bg-neutral-800 px-2 py-1 rounded inline-block">
        {`${input.path}${range}`}
      </code>
    );
  }

  if (input === null || input === undefined) {
    return (
      <div className="text-xs text-neutral-500 italic">
        {t(I18nKey.ACP_TOOL_CALL$NO_INPUT)}
      </div>
    );
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(input, null, 2);
  } catch {
    serialized = String(input);
  }
  return (
    <pre className="text-xs bg-neutral-800 p-2 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
      {serialized}
    </pre>
  );
}

/**
 * Renders ``raw_output``. Strings drop into a <pre>; structured data is
 * pretty-printed JSON. Long content is bounded + scrollable with a
 * truncation marker mirroring existing command-output cards.
 */
function ToolCallOutputView({ output }: { output: unknown }) {
  const { t } = useTranslation();

  if (output === null || output === undefined || output === "") {
    return (
      <div className="text-xs text-neutral-500 italic">
        {t(I18nKey.ACP_TOOL_CALL$NO_OUTPUT)}
      </div>
    );
  }

  let text: string;
  if (typeof output === "string") {
    text = output;
  } else {
    try {
      text = JSON.stringify(output, null, 2);
    } catch {
      text = String(output);
    }
  }

  const truncated = text.length > MAX_OUTPUT_PREVIEW;
  const shown = truncated ? `${text.slice(0, MAX_OUTPUT_PREVIEW)}\n…` : text;

  return (
    <div className="flex flex-col gap-1">
      <pre className="text-xs bg-neutral-800 p-2 rounded overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
        {shown}
      </pre>
      {truncated && (
        <div className="text-[10px] text-neutral-500 italic">
          {t(I18nKey.ACP_TOOL_CALL$TRUNCATED, {
            shown: MAX_OUTPUT_PREVIEW,
            total: text.length,
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ event }: { event: ACPToolCallEvent }) {
  const { t } = useTranslation();
  const isError = hasError(event);

  if (isError) {
    return (
      <span
        data-testid="acp-tool-call-status-failed"
        className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-red-900/50 text-red-300"
      >
        {t(I18nKey.ACP_TOOL_CALL$FAILED)}
      </span>
    );
  }

  if (event.status === "in_progress") {
    return (
      <span
        data-testid="acp-tool-call-status-in-progress"
        className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-neutral-700 text-neutral-200"
      >
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        {t(I18nKey.ACP_TOOL_CALL$IN_PROGRESS)}
      </span>
    );
  }

  if (event.status === "completed") {
    return (
      <span
        data-testid="acp-tool-call-status-completed"
        className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-green-900/40 text-green-300"
      >
        <CheckCircle className="h-3 w-3 fill-success" />
        {t(I18nKey.ACP_TOOL_CALL$COMPLETED)}
      </span>
    );
  }

  return null;
}

function ToolKindBadge({
  toolKind,
}: {
  toolKind: ACPToolCallEvent["tool_kind"];
}) {
  if (!toolKind) return null;
  return (
    <span
      data-testid="acp-tool-call-kind"
      className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-neutral-800 text-neutral-400"
    >
      {toolKind}
    </span>
  );
}

export function ACPToolCallEventMessage({
  event,
}: ACPToolCallEventMessageProps) {
  const { t } = useTranslation();
  const isError = hasError(event);

  const titleClassName =
    event.tool_kind === "execute"
      ? "font-mono text-sm truncate"
      : "text-sm truncate";

  const title = (
    <span className="flex items-center gap-2 min-w-0">
      <ToolKindBadge toolKind={event.tool_kind} />
      <StatusPill event={event} />
      <span
        className={`${titleClassName} ${isError ? "text-red-300" : "text-neutral-200"}`}
        title={event.title}
      >
        {event.title}
      </span>
    </span>
  );

  const outputSummary = summarizeOutput(event.raw_output);

  const details = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase">
          {t(I18nKey.ACP_TOOL_CALL$INPUT)}
        </h3>
        <ToolCallInputView event={event} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase">
          {t(I18nKey.ACP_TOOL_CALL$OUTPUT)}
        </h3>
        {outputSummary && !isError && (
          <div className="text-[11px] text-neutral-500 truncate">
            {outputSummary}
          </div>
        )}
        <ToolCallOutputView output={event.raw_output} />
      </div>
    </div>
  );

  return (
    <div
      data-testid="acp-tool-call-event"
      data-tool-call-id={event.tool_call_id}
      className={isError ? "text-red-300" : undefined}
    >
      <GenericEventMessage
        title={title}
        details={details}
        initiallyExpanded={false}
      />
    </div>
  );
}
