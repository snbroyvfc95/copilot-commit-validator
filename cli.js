#!/usr/bin/env node
import { validateCommit, guidedRecommit } from "./index.js";

const args = process.argv.slice(2);

if (args.includes("--recommit")) {
	guidedRecommit();
} else {
	validateCommit();
}