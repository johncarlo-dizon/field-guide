import { equipmentBlocks, equipmentParts } from "@/db/schema";
import type { db } from "@/lib/db";
import type { PartInput } from "@/lib/equipment-input";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function insertParts(tx: Tx, equipmentId: string, list: PartInput[]) {
  for (let i = 0; i < list.length; i++) {
    const [p] = await tx
      .insert(equipmentParts)
      .values({ equipmentId, position: i, title: list[i].title })
      .returning({ id: equipmentParts.id });

    const blocks = list[i].blocks;
    if (blocks.length) {
      await tx
        .insert(equipmentBlocks)
        .values(blocks.map((b, j) => ({ partId: p.id, position: j, ...b })));
    }
  }
}