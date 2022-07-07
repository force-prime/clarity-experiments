
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "mm-dlc tests",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;

        let assetMaps = chain.getAssetsMaps();

        const deployerBalanceInitial = assetMaps.assets['STX'][deployer.address];
        const balance1Initial = assetMaps.assets['STX'][wallet_1.address];

        const cost = 1000000;
        const fee = 2 * cost / 100;
        const costStr = "u" + cost;

        let block = chain.mineBlock([
            Tx.contractCall('mm-dlc', 'start-mm', ["0x01", costStr], wallet_1.address), 
            Tx.contractCall('mm-dlc', 'cancel-mm', ["0x01"], wallet_1.address), 
            Tx.contractCall('mm-dlc', 'start-mm', ["0x01", costStr], wallet_1.address), 
            Tx.contractCall('mm-dlc', 'start-mm', ["0x02", costStr], wallet_1.address), 
            Tx.contractCall('mm-dlc', 'accept-mm', ["0x02"], wallet_2.address), 
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();

        assetMaps = chain.getAssetsMaps();
        const balance1AfterBlock1 = assetMaps.assets['STX'][wallet_1.address];

        assertEquals(balance1AfterBlock1, balance1Initial - cost);

        block.receipts[2].result.expectErr().expectUint(501); // not started
        block.receipts[3].result.expectOk();
        block.receipts[4].result.expectOk();
  
        block = chain.mineBlock([
            Tx.contractCall('mm-dlc', 'resolve-rewards', ["0x02"], wallet_2.address), 
            Tx.contractCall('mm-dlc', 'set-result', ["0x02", "u1"], wallet_2.address), 
            Tx.contractCall('mm-dlc', 'set-result', ["0x02", "u0"], deployer.address), 
            Tx.contractCall('mm-dlc', 'set-result', ["0x02", "u1"], deployer.address), 
        ]);

        //console.log(block.receipts[0].result);
        block.receipts[0].result.expectErr().expectUint(302); // not timeout
        block.receipts[1].result.expectErr().expectUint(601); // not authorized
        block.receipts[2].result.expectErr().expectUint(401); // incorrect data (result)
        block.receipts[3].result.expectOk();

        assetMaps = chain.getAssetsMaps();
        const balance1AfterBlock2 = assetMaps.assets['STX'][wallet_1.address];
        const deployerBalanceAfterBlock2 = assetMaps.assets['STX'][deployer.address];

        assertEquals(deployerBalanceAfterBlock2, deployerBalanceInitial + fee);
        assertEquals(balance1AfterBlock2, balance1Initial + cost - fee);
    },
});
