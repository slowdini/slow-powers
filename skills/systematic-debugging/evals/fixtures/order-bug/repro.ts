import { describeOrder } from "./orderHandler";

// A normal order with a customer attached — works fine.
console.log(
  describeOrder({ id: "A-1001", customer: { id: "c-7", name: "Mia" } }),
);

// A guest-checkout order has no customer attached. Production sees these
// intermittently and this is where the crash is reported.
console.log(describeOrder({ id: "A-1002" }));
