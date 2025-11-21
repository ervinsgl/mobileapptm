sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Extract UDF value by externalId from activity's udfValues array
         */
        getUdfValue(activity, udfExternalId) {
            if (!activity.udfValues || !Array.isArray(activity.udfValues)) {
                return null;
            }

            const udfValue = activity.udfValues.find(udf =>
                udf.udfMeta && udf.udfMeta.externalId === udfExternalId
            );

            return udfValue ? udfValue.value : null;
        },

        /**
         * Group activities by Product Description and Parent Item ID
         * Returns array of product groups with their activities
         */
        groupActivitiesByProduct(activities, serviceOrderCode) {
            console.log('\n========================================');
            console.log('PRODUCT GROUP: Grouping Activities');
            console.log('========================================');
            console.log('Total activities:', activities.length);
            console.log('Service Order Code:', serviceOrderCode);

            const groups = {};

            activities.forEach(activity => {
                // Extract UDF values
                const productDescription = this.getUdfValue(activity, 'Z_ProductDescription');
                const parentItemId = this.getUdfValue(activity, 'Z_ActParentItemID');

                // Skip if no product description
                if (!productDescription) {
                    console.log('  -> Skipping (no product description)');
                    return;
                }

                // Create SO Item ID (e.g., "8200001975/100")
                const soItemId = parentItemId
                    ? `${serviceOrderCode}/${parentItemId}`
                    : serviceOrderCode;

                // Create unique group key
                const groupKey = `${productDescription}|||${soItemId}`;

                // Initialize group if doesn't exist
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        key: groupKey,
                        productDescription: productDescription,
                        soItemId: soItemId,
                        parentItemId: parentItemId || '',
                        activities: []
                    };
                }

                // Add activity to group
                groups[groupKey].activities.push({
                    id: activity.id,
                    code: activity.code,
                    subject: activity.subject,
                    status: activity.status,
                    executionStage: activity.executionStage,
                    type: activity.type,
                    plannedStartDate: activity.plannedStartDate,
                    plannedEndDate: activity.plannedEndDate,
                    fullActivity: activity  // Include full activity object for detailed fields
                });
            });

            // Convert to array and sort
            const groupArray = Object.values(groups);

            // Sort by SO Item ID, then by Product Description
            groupArray.sort((a, b) => {
                if (a.soItemId !== b.soItemId) {
                    return a.soItemId.localeCompare(b.soItemId);
                }
                return a.productDescription.localeCompare(b.productDescription);
            });

            // SORT ACTIVITIES BY EXTERNAL ID within each group
            groupArray.forEach(group => {
                group.activities.sort((a, b) => {
                    const externalIdA = a.fullActivity?.externalId || a.code || '';
                    const externalIdB = b.fullActivity?.externalId || b.code || '';
                    return externalIdA.localeCompare(externalIdB);
                });
            });

            console.log('\n--- GROUPED RESULTS ---');
            console.log('Total groups:', groupArray.length);
            groupArray.forEach((group, index) => {
                console.log(`\nGroup ${index + 1}:`);
                console.log(`  Product: ${group.productDescription}`);
                console.log(`  SO Item: ${group.soItemId}`);
                console.log(`  Activities: ${group.activities.length}`);
                group.activities.forEach((act, actIndex) => {
                    console.log(`    ${actIndex + 1}. ${act.code} - ${act.subject}`);
                });
            });

            return groupArray;
        },

        /**
         * Format product group for display
         */
        formatProductGroupTitle(productDescription, soItemId) {
            return `Product: ${productDescription} | SO Item: ${soItemId}`;
        }
    };
});