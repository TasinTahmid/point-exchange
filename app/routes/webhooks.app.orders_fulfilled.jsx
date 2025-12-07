import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, admin } = await authenticate.webhook(request);

  const orderData = {
    customerId: payload.customer?.id,
    totalPriceAmount: payload.total_price,
    currency: payload.currency,
    orderId: payload.id,
    orderNumber: payload.order_number
  };
  let totalCustomerPoints;

  console.log(`-------------------THis is from orders/fulfilled webhook 4 ---------------`);
  console.log(`Payload orders/fulfilled webhook ::: ${JSON.stringify(orderData)}`);
  console.log(`-------------------THis is from orders/fulfilled webhook 4 ---------------`);

  const GetCustomerWithMetafieldQuery = `query GetCustomerWithMetafields{
    customer(id: "gid://shopify/Customer/${orderData.customerId}") {
      id
      totalPoints: metafield(namespace: "custom", key: "total_points_points_exchange") {
        id
        value
        type
      }
    }
  }`;

  try {
    const response = await admin.graphql(GetCustomerWithMetafieldQuery);

    const { data } = await response.json();

    totalCustomerPoints = data?.customer?.totalPoints?.value;

    console.log("Customers point:::", data)
  } catch (error) {
    console.log("Webhook error::", error)
  }

  let pointRewardOffset;
  const GetPointRewardOffset = `query GetPointRewardOffset {
    shop {
      metafield(namespace: "custom", key: "point_reward_offset_point_exchange") {
        id
        namespace
        key
        type
        value
      }
    }
  }`;

  try {
    const response = await admin.graphql(GetPointRewardOffset);

    const { data } = await response.json();

    pointRewardOffset = data?.shop?.metafield?.value;

    console.log("Customers point:::", pointRewardOffset)
  } catch (error) {
    console.log("Webhook error::", error)
  }


  
  try {
    if(pointRewardOffset && totalCustomerPoints){
      const updatedPoints = parseInt(Number(totalCustomerPoints) + Number(orderData.totalPriceAmount) * pointRewardOffset);
      console.log("updatedPoints:::", updatedPoints)
      const updateCustomerMetafieldMutation = `mutation updateCustomerMetafield($input: CustomerInput!, $namespace: String!, $key: String!) {
        customerUpdate(input: $input) {
          customer {
            id
            metafield(namespace: $namespace, key: $key) {
              namespace
              key
              type
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;
    
      const updateCustomerMetafieldsVariables = {
        "input": {
          "id": `gid://shopify/Customer/${orderData.customerId}`,
          "metafields": [
            {
              "namespace": "custom",
              "key": "total_points_points_exchange",
              "type": "number_integer",
              "value": `${updatedPoints}`
            }
          ]
        },
        "namespace": "custom",
        "key": "total_points_points_exchange"
      };
      const response = await admin.graphql(updateCustomerMetafieldMutation, {
        variables: updateCustomerMetafieldsVariables,
      });
  
      const { data } = await response.json();
  
      console.log("Updated Points Metafield2:::", data.customerUpdate)
    }
  } catch (error) {
    console.log("Webhook error::", error)
  }

  return new Response();
};
