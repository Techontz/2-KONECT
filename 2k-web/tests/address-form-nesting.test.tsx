import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Saving an address must not place an order.
 *
 * The checkout page wraps the page in one <form onSubmit={placeOrder}> and
 * renders the address form inside it. That nests a <form> in a <form>, which
 * HTML forbids — but the interesting part is not the validity, it is what the
 * DOM does about it.
 *
 * `submit` bubbles. React listens at the root and replays events through the
 * React tree, so a submit raised on the inner form reaches the outer form's
 * onSubmit too. preventDefault() stops the browser navigating; it does nothing
 * about propagation. So one click on "Save address" ran the address save AND
 * the order placement, and the order placement is the one the shopper sees:
 * either "choose a delivery address" thrown over the form they are standing
 * in, or — on a non-gateway channel — an order placed outright, the cart
 * emptied and the page navigated away.
 *
 * Either way the address they just typed is gone.
 */

vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

const { AddressForm } = await import("@/components/account/AddressForm");

/** Exactly the checkout page's shape: one outer form, the address form inside. */
function Nested({ outer, inner }: { outer: () => void; inner: () => Promise<void> }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); outer(); }}>
      <AddressForm initial={null} onSubmit={inner} onCancel={() => undefined} />
      <button type="submit">Pay and place order</button>
    </form>
  );
}

function fill() {
  fireEvent.change(screen.getByLabelText(/address\.fullName/), { target: { value: "Asha Mnyika" } });
  fireEvent.change(screen.getByLabelText(/address\.phone/), { target: { value: "0712345678" } });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Dar es Salaam" } });
  fireEvent.change(screen.getByLabelText(/address\.city/), { target: { value: "Kinondoni" } });
}

describe("an address form rendered inside the checkout form", () => {
  it("saves the address without also submitting the page", async () => {
    const outer = vi.fn();
    const inner = vi.fn().mockResolvedValue(undefined);

    render(<Nested outer={outer} inner={inner} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /address\.saveAddress/ }));

    await waitFor(() => expect(inner).toHaveBeenCalledOnce());

    // The whole bug in one assertion: saving an address is not an instruction
    // to place an order.
    expect(outer).not.toHaveBeenCalled();
  });

  it("does not submit the page when Enter is pressed in an address field", async () => {
    const outer = vi.fn();
    const inner = vi.fn().mockResolvedValue(undefined);

    render(<Nested outer={outer} inner={inner} />);
    fill();

    // Implicit submission is the same bug through a different door, and it is
    // the one that appears the moment the inner <form> stops being a form.
    fireEvent.keyDown(screen.getByLabelText(/address\.city/), { key: "Enter", code: "Enter" });

    // Enter saves, and stops there.
    await waitFor(() => expect(inner).toHaveBeenCalledOnce());
    expect(outer).not.toHaveBeenCalled();
  });

  it("leaves Enter alone inside the free-text details box", async () => {
    const outer = vi.fn();
    const inner = vi.fn().mockResolvedValue(undefined);

    render(<Nested outer={outer} inner={inner} />);
    fill();

    // A newline is what Enter means in a textarea, so it must not save.
    fireEvent.keyDown(screen.getByLabelText(/address\.notes/), {
      key: "Enter", code: "Enter",
    });

    expect(inner).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });

  it("still refuses to save an address that is missing required fields", async () => {
    const outer = vi.fn();
    const inner = vi.fn().mockResolvedValue(undefined);

    render(<Nested outer={outer} inner={inner} />);
    fireEvent.click(screen.getByRole("button", { name: /address\.saveAddress/ }));

    await waitFor(() => expect(screen.getByText(/address\.errName/)).toBeInTheDocument());
    expect(inner).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });
});
