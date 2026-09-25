"use client";

import React from "react";
import ThePasswordGameRound, { ThePasswordGameRoundProps } from "./ThePasswordGameRound";

export type CrackPasswordRoundProps = ThePasswordGameRoundProps;

export default function CrackPasswordRound(props: CrackPasswordRoundProps) {
  return <ThePasswordGameRound {...props} />;
}
