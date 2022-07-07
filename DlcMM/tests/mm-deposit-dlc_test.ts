
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Deposit dlc tests",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;

        let assetMaps = chain.getAssetsMaps();

        const deployerBalanceInitial = assetMaps.assets['STX'][deployer.address];
        const balance1Initial = assetMaps.assets['STX'][wallet_1.address];

        const cost = 1000000;
        const fee = 5 * cost / 100;
        const costStr = "u" + cost;

        let block = chain.mineBlock([
            Tx.contractCall('mm-deposit-dlc', 'deposit', [costStr], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'deposit', [costStr], wallet_2.address), 
            Tx.contractCall('mm-deposit-dlc', 'get-my-balance', [], wallet_2.address), 
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectOk();
        block.receipts[2].result.expectUint(cost - fee);

        assetMaps = chain.getAssetsMaps();
        const balance1AfterBlock1 = assetMaps.assets['STX'][wallet_1.address];
        const deployerBalanceAfterBlock1 = assetMaps.assets['STX'][deployer.address];

        assertEquals(deployerBalanceAfterBlock1, deployerBalanceInitial + 2 * fee);
        assertEquals(balance1AfterBlock1, balance1Initial - cost);

        block = chain.mineBlock([
            Tx.contractCall('mm-deposit-dlc', 'deposit', [costStr], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'get-my-balance', [], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'start-game', ["0x02", types.principal(wallet_1.address), types.principal(wallet_2.address), costStr], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'set-result', ["0x02", "u1"], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'start-game', ["0x02", types.principal(wallet_1.address), types.principal(wallet_2.address), costStr], deployer.address), 
            Tx.contractCall('mm-deposit-dlc', 'deposit', [costStr], wallet_2.address), 
            Tx.contractCall('mm-deposit-dlc', 'start-game', ["0x02", types.principal(wallet_1.address), types.principal(wallet_2.address), costStr], deployer.address), 
            Tx.contractCall('mm-deposit-dlc', 'get-my-balance', [], wallet_1.address), 
        ]);

        block.receipts[0].result.expectOk();
        block.receipts[1].result.expectUint(2 * (cost - fee));
        block.receipts[2].result.expectErr().expectUint(601);
        block.receipts[3].result.expectErr().expectUint(601);
        block.receipts[4].result.expectErr().expectUint(301);
        block.receipts[5].result.expectOk();
        block.receipts[6].result.expectOk();
        block.receipts[7].result.expectUint(2 * (cost - fee) - cost);

        assetMaps = chain.getAssetsMaps();
        const balance1AfterBlock2 = assetMaps.assets['STX'][wallet_1.address];
        const deployerBalanceAfterBlock2 = assetMaps.assets['STX'][deployer.address];

        assertEquals(deployerBalanceAfterBlock2, deployerBalanceAfterBlock1 + fee * 2);
        assertEquals(balance1AfterBlock2, balance1AfterBlock1 - cost);

        block = chain.mineBlock([
            Tx.contractCall('mm-deposit-dlc', 'cancel-game', ["0x02"], wallet_2.address), 
            Tx.contractCall('mm-deposit-dlc', 'set-result', ["0x02", "u1"], deployer.address), 
            Tx.contractCall('mm-deposit-dlc', 'get-my-balance', [], wallet_1.address), 
            Tx.contractCall('mm-deposit-dlc', 'withdraw', [costStr], wallet_1.address), 
        ]);

        block.receipts[0].result.expectErr().expectUint(302);
        block.receipts[1].result.expectOk();
        block.receipts[2].result.expectUint(2 * (cost - fee) + cost);
        block.receipts[3].result.expectErr().expectUint(302);

        for (let i = 0; i < 19; i++) {
            block = chain.mineBlock([
                Tx.contractCall('mm-deposit-dlc', 'withdraw', [costStr], wallet_1.address), 
            ]);
            block.receipts[0].result.expectErr().expectUint(302);
        }
        
        block = chain.mineBlock([
            Tx.contractCall('mm-deposit-dlc', 'withdraw', [costStr], wallet_1.address), 
        ]);
        block.receipts[0].result.expectOk();

        assetMaps = chain.getAssetsMaps();
        const balance1AfterAllBlocks = assetMaps.assets['STX'][wallet_1.address];
        assertEquals(balance1AfterAllBlocks, balance1Initial - cost);

        for (let i = 0; i < 10; i++) {
            block = chain.mineBlock([
                Tx.contractCall('mm-deposit-dlc', 'apply-service-cost', [types.principal(wallet_1.address)], deployer.address), 
            ]);
            block.receipts[0].result.expectErr().expectUint(302);
        }
    },
});
