import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { deferred } from "../../../../test/deferred";
import { testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { sessionQuery } from "../../api/useCurrentUser";
import { LoginForm } from "./LoginForm";

const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  post.mockReset();
});

function setup() {
  const view = renderRoutes([{ path: "/login", element: <LoginForm /> }], {
    path: "/login",
    user: null,
  });
  return {
    ...view,
    user: userEvent.setup(),
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Log in" }),
  };
}

/** Fills in a valid form and submits it. */
async function logIn(form: ReturnType<typeof setup>) {
  await form.user.type(form.email, "ana@example.com");
  await form.user.type(form.password, "correct-horse");
  await form.user.click(form.submit);
}

describe("LoginForm", () => {
  describe("client validation", () => {
    it("shows no errors before the first submit", () => {
      const { email, password } = setup();

      expect(email).not.toHaveAttribute("aria-invalid");
      expect(email).not.toHaveAccessibleDescription();
      expect(password).not.toHaveAttribute("aria-invalid");
      expect(password).not.toHaveAccessibleDescription();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sends nothing and marks both fields when the form is empty", async () => {
      const { user, email, password, submit } = setup();

      await user.click(submit);

      expect(post).not.toHaveBeenCalled();
      expect(email).toBeInvalid();
      expect(email).toHaveAccessibleDescription("Enter your email address.");
      expect(password).toBeInvalid();
      expect(password).toHaveAccessibleDescription("Enter your password.");
    });

    it("moves focus to the first invalid field", async () => {
      const { user, email, submit } = setup();

      await user.click(submit);

      expect(email).toHaveFocus();
    });

    it("moves focus to the password when only that is missing", async () => {
      const { user, email, password, submit } = setup();

      await user.type(email, "ana@example.com");
      await user.click(submit);

      expect(post).not.toHaveBeenCalled();
      expect(password).toHaveFocus();
    });

    it("rejects a malformed email", async () => {
      const { user, email, password, submit } = setup();

      await user.type(email, "ana@example");
      await user.type(password, "correct-horse");
      await user.click(submit);

      expect(post).not.toHaveBeenCalled();
      expect(email).toHaveAccessibleDescription(
        "Enter a valid email address, like name@example.com.",
      );
    });

    it("clears a field's error while typing, after the first submit", async () => {
      const { user, email, submit } = setup();
      await user.click(submit);

      await user.type(email, "ana@example.com");

      expect(email).toBeValid();
      expect(email).not.toHaveAccessibleDescription();
    });
  });

  describe("submitting", () => {
    it("posts the email and password to /auth/login", async () => {
      post.mockResolvedValue({ user: testUser });
      const form = setup();

      await logIn(form);

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith("/auth/login", {
        email: "ana@example.com",
        password: "correct-horse",
      });
    });

    it("sends the password exactly as typed, spaces included", async () => {
      post.mockResolvedValue({ user: testUser });
      const { user, email, password, submit } = setup();

      await user.type(email, "ana@example.com");
      await user.type(password, " correct horse ");
      await user.click(submit);

      expect(post).toHaveBeenCalledWith("/auth/login", {
        email: "ana@example.com",
        password: " correct horse ",
      });
    });

    it("stores the signed-in user as the session", async () => {
      post.mockResolvedValue({ user: testUser });
      const form = setup();

      await logIn(form);

      expect(form.queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testUser);
    });

    it("disables the button while the request is running", async () => {
      const request = deferred<{ user: typeof testUser }>();
      post.mockReturnValue(request.promise);
      const form = setup();

      await logIn(form);

      expect(form.submit).toBeDisabled();
      expect(form.submit).toHaveTextContent("Logging in …");

      // A second submit with Enter is ignored.
      await form.user.type(form.password, "{Enter}");
      expect(post).toHaveBeenCalledTimes(1);

      request.resolve({ user: testUser });
      expect(await screen.findByRole("button", { name: "Log in" })).toBeEnabled();
    });
  });

  describe("server errors", () => {
    it("shows the server's message for wrong credentials", async () => {
      post.mockRejectedValue(new ApiError(401, "Invalid email or password"));
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Invalid email or password",
      );
      expect(form.queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
    });

    it("adds a hint to wait when there were too many attempts", async () => {
      post.mockRejectedValue(
        new ApiError(429, "Too many login attempts. Please try again later."),
      );
      const form = setup();

      await logIn(form);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Too many login attempts. Please try again later.");
      expect(alert).toHaveTextContent("Too many attempts try again later");
    });

    it("shows the server's field errors for a 400", async () => {
      post.mockRejectedValue(
        new ApiError(400, "Invalid input", { email: ["Invalid email address"] }),
      );
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please check the highlighted fields.",
      );
      expect(form.email).toBeInvalid();
      expect(form.email).toHaveAccessibleDescription("Invalid email address");
      expect(form.password).toBeValid();
    });

    it("shows a connection error when the server can't be reached", async () => {
      post.mockRejectedValue(new ApiError(0, "Can't reach the server."));
      const form = setup();

      await logIn(form);

      expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
    });

    it("removes the server error as soon as a field changes", async () => {
      post.mockRejectedValue(new ApiError(401, "Invalid email or password"));
      const form = setup();
      await logIn(form);
      await screen.findByRole("alert");

      await form.user.type(form.password, "x");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("can be submitted again after an error", async () => {
      post.mockRejectedValueOnce(new ApiError(401, "Invalid email or password"));
      post.mockResolvedValueOnce({ user: testUser });
      const form = setup();
      await logIn(form);
      await screen.findByRole("alert");

      await form.user.click(form.submit);

      expect(post).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(form.queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testUser);
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
