import { describe, expect, it } from "vitest";
import { EXPERIMENTAL_EMOTION_DESC, EXPERIMENTAL_EMOTION_TITLE } from "./experimental-emotion";

describe("experimental emotion notice", () => {
  it("labels the estimate as experimental", () => {
    expect(EXPERIMENTAL_EMOTION_TITLE).toMatch(/experimental/i);
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/^Experimental\./);
  });
  it("explains it comes from the voice, may use a private server and is never invented", () => {
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/voz/);
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/no de las palabras/);
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/servidor/);
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/Sin audio o sin el modelo no se estima una emoción/);
    expect(EXPERIMENTAL_EMOTION_DESC).toMatch(/DS 115-2025-PCM/);
  });
  it("does not ask for an adult or guardian authorization", () => {
    expect(EXPERIMENTAL_EMOTION_DESC).not.toMatch(/autoriza|consentimiento/i);
  });
});
