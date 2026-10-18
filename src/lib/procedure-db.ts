import { processBlocks, processes } from "@/db/schema";
import type { db } from "@/lib/db";
import type { ProcessInput } from "@/lib/procedure-input";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function insertProcesses(tx: Tx, procedureId: string, list: ProcessInput[]) {
  for (let i = 0; i < list.length; i++) {
    const [p] = await tx
      .insert(processes)
      .values({ procedureId, position: i, title: list[i].title })
      .returning({ id: processes.id });

    const blocks = list[i].blocks;
    if (blocks.length) {
      await tx
        .insert(processBlocks)
        .values(blocks.map((b, j) => ({ processId: p.id, position: j, ...b })));
    }
  }
}