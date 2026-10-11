import { expect, test } from "@playwright/test";
import { mapearProfundidadeLiderados } from "../src/lib/permissions/hierarchy.js";

test("hierarchical team includes direct and indirect reports, excludes outsiders and terminates on cycles", () => {
  const people = [
    { id: "manager", supervisor_id: "root", papel: "supervisor" },
    { id: "employee", supervisor_id: "manager", papel: "funcionario" },
    { id: "peer", supervisor_id: "root", papel: "funcionario" },
    { id: "outsider", supervisor_id: "another-root", papel: "funcionario" },
    { id: "root", supervisor_id: "employee", papel: "supervisor" },
  ];

  const levels = mapearProfundidadeLiderados("root", people);
  expect([...levels.entries()].sort()).toEqual([
    ["employee", 2],
    ["manager", 1],
    ["peer", 1],
  ]);
});

test("the chain goes through anyone with reports, including Quality and the board", () => {
  const people = [
    { id: "keila", supervisor_id: "ceo", papel: "qualidade" },
    { id: "analista", supervisor_id: "keila", papel: "funcionario" },
    { id: "socio", supervisor_id: null, papel: "supervisor" },
  ];
  const levels = mapearProfundidadeLiderados("ceo", people);
  expect([...levels.entries()].sort()).toEqual([["analista", 2], ["keila", 1]]);
});
