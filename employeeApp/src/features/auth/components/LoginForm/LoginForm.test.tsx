import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { deferred } from "../../../../test/deferred";
import { testEmployee } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { sessionQuery } from "../../api/useCurrentUser";
import { Guard } from "../Guard";
import { LoginForm } from "./LoginForm";

const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  post.mockReset();
});

function setup() {
  // The same guards as app/router.tsx, so a successful login can be followed.
  const view = renderRoutes(
    [
      { element: <Guard zone="guest" />, children: [{ path: "/", element: <LoginForm /> }] },
      {
        element: <Guard zone="employee" />,
        children: [{ path: "/availability", element: <p>availability page</p> }],
      },
    ],
    { path: "/", user: null },
  );
  return {
    ...view,
    user: userEvent.setup(),
    username: screen.getByLabelText("Username"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Log in" }),
  };
}

/** Fills in a valid form and submits it. */
async function logIn(form: ReturnType<typeof setup>) {
  await form.user.type(form.username, "jonas.becker");
  await form.user.type(form.password, "13031998");
  await form.user.click(form.submit);
}

describe("LoginForm", () => {
  describe("client validation", () => {
    it("shows no errors before the first submit", () => {
      const { username, password } = setup();

      expect(username).not.toHaveAttribute("aria-invalid");
      expect(username).not.toHaveAccessibleDescription();
      expect(password).not.toHaveAttribute("aria-invalid");
      expect(password).not.toHaveAccessibleDescription();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sends nothing and marks both fields when the form is empty", async () => {
      const { user, username, password, submit } = setup();

      await user.click(submit);

      expect(post).not.toHaveBeenCalled();
      expect(username).toBeInvalid();
      expect(username).toHaveAccessibleDescription("Enter your username.");
      expect(password).toBeInvalid();
      expect(password).toHaveAccessibleDescription("Enter your password.");
    });

    it("moves focus to the first invalid field", async () => {
      const { user, username, submit } = setup();

      await user.click(submit);

      expect(username).toHaveFocus();
    });

    it("moves focus to the password when only that is missing", async () => {
      const { user, username, password, submit } = setup();

      await user.type(username, "jonas.becker");
      await user.click(submit);

      expect(post).not.toHaveBeenCalled();
      expect(password).toHaveFocus();
    });

    it("clears a field's error while typing, after the first submit", async () => {
      const { user, username, submit } = setup();
      await user.click(submit);

      await user.type(username, "jonas.becker");

      expect(username).toBeValid();
      expect(username).not.toHaveAccessibleDescription();
    });
  });

  describe("submitting", () => {
    it("posts the username and password to /employees/login", async () => {
      post.mockResolvedValue({ user: testEmployee });
      const form = setup();

      await logIn(form);

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith("/employees/login", {
        username: "jonas.becker",
        password: "13031998",
      });
    });

    it("trims the username but sends the password exactly as typed", async () => {
      post.mockResolvedValue({ user: testEmployee });
      const { user, username, password, submit } = setup();

      await user.type(username, "  jonas.becker ");
      await user.type(password, " secret pw ");
      await user.click(submit);

      expect(post).toHaveBeenCalledWith("/employees/login", {
        username: "jonas.becker",
        password: " secret pw ",
      });
    });

    it("stores the employee as the session and opens the availability page", async () => {
      post.mockResolvedValue({ user: testEmployee });
      const form = setup();

      await logIn(form);

      expect(await screen.findByText("availability page")).toBeInTheDocument();
      expect(form.router.state.location.pathname).toBe("/availability");
      expect(form.queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testEmployee);
    });

    it("disables the button while the request is running", async () => {
      const request = deferred<{ user: typeof testEmployee }>();
      post.mockReturnValue(request.promise);
      const form = setup();

      await logIn(form);

      expect(form.submit).toBeDisabled();
      expect(form.submit).toHaveTextContent("Logging in …");

      // A second submit with Enter is ignored.
      await form.user.type(form.password, "{Enter}");
      expect(post).toHaveBeenCalledTimes(1);

      request.resolve({ user: testEmployee });
      expect(await screen.findByText("availability page")).toBeInTheDocument();
    });
  });

  describe("server errors", () => {
    it("shows the server's message for a wrong username or password", async () => {
      post.mockRejectedValue(new ApiError(401, "Invalid username or password"));
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Invalid username or password",
      );
      expect(form.router.state.location.pathname).toBe("/");
      expect(form.queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
    });

    it("shows the server's message when there were too many attempts", async () => {
      post.mockRejectedValue(
        new ApiError(
          429,
          "Too many failed attempts for this account. Please try again in 15 minutes.",
        ),
      );
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Too many failed attempts for this account. Please try again in 15 minutes.",
      );
    });

    it("shows the server's field errors for a 400", async () => {
      post.mockRejectedValue(
        new ApiError(400, "Invalid input", {
          username: ["Too big: expected string to have <=255 characters"],
        }),
      );
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please check the highlighted fields.",
      );
      expect(form.username).toBeInvalid();
      expect(form.username).toHaveAccessibleDescription(
        "Too big: expected string to have <=255 characters",
      );
      expect(form.password).toBeValid();
    });

    it("shows a connection error when the server can't be reached", async () => {
      post.mockRejectedValue(new ApiError(0, "Can't reach the server."));
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
    });

    it("removes the server error as soon as a field changes", async () => {
      post.mockRejectedValue(new ApiError(401, "Invalid username or password"));
      const form = setup();
      await logIn(form);
      await screen.findByRole("alert");

      await form.user.type(form.password, "x");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("can be submitted again after an error", async () => {
      post.mockRejectedValueOnce(new ApiError(401, "Invalid username or password"));
      post.mockResolvedValueOnce({ user: testEmployee });
      const form = setup();
      await logIn(form);
      await screen.findByRole("alert");

      await form.user.click(form.submit);

      expect(post).toHaveBeenCalledTimes(2);
      expect(await screen.findByText("availability page")).toBeInTheDocument();
    });
  });

  it("shows and hides the password with the toggle", async () => {
    const { user, password } = setup();
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "password");
  });
});
