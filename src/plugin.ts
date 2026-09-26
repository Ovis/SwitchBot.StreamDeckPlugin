import streamDeck, { LogLevel } from "@elgato/streamdeck";

streamDeck.logger.setLevel(LogLevel.INFO);

await streamDeck.connect();
