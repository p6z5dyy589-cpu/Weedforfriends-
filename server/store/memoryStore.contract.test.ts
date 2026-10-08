import { MemoryStore } from "./memoryStore";
import { storeContract } from "./storeContract";

storeContract("memory", async () => new MemoryStore());
