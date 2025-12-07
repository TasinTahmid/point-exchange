import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, admin } = await authenticate.webhook(request);

  const orderData = {
    customerId: payload.customer?.id,
    totalAmount: payload.total_price,
    currency: payload.currency,
    orderId: payload.id,
    orderNumber: payload.order_number
  };
  console.log(`-------------------THis is from webhook 4 ---------------`);
  console.log(`Payload webhook ::: ${JSON.stringify(orderData)}`);
  console.log(`-------------------THis is from webhook 4 ---------------`);

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
          "value": `6000`
        }
      ]
    },
    "namespace": "custom",
    "key": "total_points_points_exchange"
  };

  try {
    const response = await admin.graphql(updateCustomerMetafieldMutation, {
      variables: updateCustomerMetafieldsVariables,
    });

    const { data } = await response.json();

    console.log("Updated Points Metafield:::", data.customerUpdate.customer)
  } catch (error) {
    console.log("Webhook error::", error)
  }

};
