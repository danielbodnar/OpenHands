import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "test-utils";
import { ACPToolCallEventMessage } from "#/components/v1/chat/event-message-components/acp-tool-call-event-message";
import { ACPToolCallEvent } from "#/types/v1/core/events/acp-tool-call-event";

const baseEvent: ACPToolCallEvent = {
  kind: "ACPToolCallEvent",
  id: "evt-1",
  timestamp: "2026-04-16T19:32:29.828069",
  source: "agent",
  tool_call_id: "toolu_01QFDF9PtYBz67yj3SwzrthQ",
  title: "gh pr diff 490 --repo OpenHands/evaluation",
  tool_kind: "execute",
  status: "completed",
  raw_input: { command: "gh pr diff 490 --repo OpenHands/evaluation" },
  raw_output:
    "diff --git a/foo b/foo\nindex abc..def\n@@ -1,1 +1,1 @@\n-old\n+new",
  content: null,
  is_error: false,
};

const makeEvent = (overrides: Partial<ACPToolCallEvent>): ACPToolCallEvent => ({
  ...baseEvent,
  ...overrides,
});

describe("ACPToolCallEventMessage", () => {
  it("renders the title, tool-kind badge, and completed status", () => {
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    expect(
      screen.getByText("gh pr diff 490 --repo OpenHands/evaluation"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("acp-tool-call-kind")).toHaveTextContent(
      "execute",
    );
    expect(
      screen.getByTestId("acp-tool-call-status-completed"),
    ).toBeInTheDocument();
  });

  it("renders a spinner pill for in-progress tool calls", () => {
    renderWithProviders(
      <ACPToolCallEventMessage
        event={makeEvent({ status: "in_progress", raw_output: null })}
      />,
    );

    expect(
      screen.getByTestId("acp-tool-call-status-in-progress"),
    ).toBeInTheDocument();
  });

  it("uses the failed pill when is_error is true", () => {
    renderWithProviders(
      <ACPToolCallEventMessage event={makeEvent({ is_error: true })} />,
    );

    expect(
      screen.getByTestId("acp-tool-call-status-failed"),
    ).toBeInTheDocument();
  });

  it("uses the failed pill when status is 'failed'", () => {
    renderWithProviders(
      <ACPToolCallEventMessage event={makeEvent({ status: "failed" })} />,
    );

    expect(
      screen.getByTestId("acp-tool-call-status-failed"),
    ).toBeInTheDocument();
  });

  it("keeps input and output collapsed by default", () => {
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    // Input/output labels live inside the expandable details block; before
    // the user expands it, they should not be in the DOM.
    expect(screen.queryByText("ACP_TOOL_CALL$INPUT")).not.toBeInTheDocument();
    expect(screen.queryByText("ACP_TOOL_CALL$OUTPUT")).not.toBeInTheDocument();
  });

  it("expands to show input command and output on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("ACP_TOOL_CALL$INPUT")).toBeInTheDocument();
    expect(screen.getByText("ACP_TOOL_CALL$OUTPUT")).toBeInTheDocument();
    expect(
      screen.getByText("gh pr diff 490 --repo OpenHands/evaluation", {
        selector: "pre",
      }),
    ).toBeInTheDocument();
  });

  it("truncates very long output with a marker", async () => {
    const user = userEvent.setup();
    const huge = "x".repeat(5000);
    renderWithProviders(
      <ACPToolCallEventMessage event={makeEvent({ raw_output: huge })} />,
    );

    await user.click(screen.getByRole("button", { name: "Expand" }));

    // The truncation marker uses an i18n key with interpolation.
    expect(screen.getByText("ACP_TOOL_CALL$TRUNCATED")).toBeInTheDocument();
  });

  it("renders edit tool input with path and content diff", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ACPToolCallEventMessage
        event={makeEvent({
          tool_kind: "edit",
          title: "Write /workspace/foo.py",
          raw_input: {
            path: "/workspace/foo.py",
            content: "print('hi')\n",
          },
          raw_output: null,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("/workspace/foo.py")).toBeInTheDocument();
    expect(screen.getByText("print('hi')")).toBeInTheDocument();
  });

  it("renders read tool input as path:offset-end", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ACPToolCallEventMessage
        event={makeEvent({
          tool_kind: "read",
          title: "Read /workspace/foo.py",
          raw_input: { path: "/workspace/foo.py", offset: 10, limit: 20 },
          raw_output: null,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("/workspace/foo.py:10-30")).toBeInTheDocument();
  });

  it("falls back to pretty-printed JSON input for 'other' kinds", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ACPToolCallEventMessage
        event={makeEvent({
          tool_kind: "other",
          raw_input: { foo: "bar", nested: { baz: 1 } },
          raw_output: null,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand" }));

    // JSON is rendered as-is within a <pre> block — find it via partial match.
    const pre = screen.getByText((_, el) =>
      Boolean(
        el?.tagName === "PRE" && el.textContent?.includes('"foo": "bar"'),
      ),
    );
    expect(pre).toBeInTheDocument();
  });

  it("exposes the tool_call_id via data attribute for dedup targeting", () => {
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    const card = screen.getByTestId("acp-tool-call-event");
    expect(card).toHaveAttribute(
      "data-tool-call-id",
      "toolu_01QFDF9PtYBz67yj3SwzrthQ",
    );
  });

  it("collapses output again on second chevron click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    await user.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("ACP_TOOL_CALL$OUTPUT")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("ACP_TOOL_CALL$OUTPUT")).not.toBeInTheDocument();
  });

  it("uses within() to keep the title inside the header row", () => {
    renderWithProviders(<ACPToolCallEventMessage event={baseEvent} />);

    const card = screen.getByTestId("acp-tool-call-event");
    expect(within(card).getByText(baseEvent.title)).toBeInTheDocument();
  });
});
