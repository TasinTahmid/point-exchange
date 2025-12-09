import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, admin } = await authenticate.webhook(request);

  const orderData = {
    customerId: payload.customer?.id,
    totalPriceAmount: payload.total_price,
    currency: payload.currency,
    orderId: payload.id,
    orderNumber: payload.order_number,
    discountCodes: payload.discount_codes
  };
  let discountList;

  console.log(`-------------------THis is from orders/create webhook 4 ---------------`);
  console.log(`Payload orders/create webhook ::: ${JSON.stringify(orderData.discountCodes)}`);
  console.log(`-------------------THis is from orders/create webhook 4 ---------------`);

  if(discountList.lenght == 0) return new Response();

  const GetMetaobjectsByCustomer = `query GetMetaobjectsByCustomer {
    metaobjects(
      type: "discount_points_exchange"
      first: 100
      query: "gid://shopify/Customer/${orderData.customerId}"
    ) {
      edges {
        node {
          id
          fields {
            key
            value
          }
        }
      }
    }
}`;

  try {
    const response = await admin.graphql(GetMetaobjectsByCustomer);

    const { data } = await response.json();

    discountList = data?.customer;

    console.log("Customers discountList:::", discountList)
  } catch (error) {
    console.log("Webhook error::", error)
  }

  // let pointRewardOffset;
  // const GetPointRewardOffset = `query GetPointRewardOffset {
  //   shop {
  //     metafield(namespace: "custom", key: "point_reward_offset_point_exchange") {
  //       id
  //       namespace
  //       key
  //       type
  //       value
  //     }
  //   }
  // }`;

  // try {
  //   const response = await admin.graphql(GetPointRewardOffset);

  //   const { data } = await response.json();

  //   pointRewardOffset = data?.shop?.metafield?.value;

  //   console.log("Customers point:::", pointRewardOffset)
  // } catch (error) {
  //   console.log("Webhook error::", error)
  // }


  
  // try {
  //   if(pointRewardOffset && totalCustomerPoints){
  //     const updatedPoints = parseInt(Number(totalCustomerPoints) + Number(orderData.totalPriceAmount) * pointRewardOffset);
  //     console.log("updatedPoints:::", updatedPoints)
  //     const updateCustomerMetafieldMutation = `mutation updateCustomerMetafield($input: CustomerInput!, $namespace: String!, $key: String!) {
  //       customerUpdate(input: $input) {
  //         customer {
  //           id
  //           metafield(namespace: $namespace, key: $key) {
  //             namespace
  //             key
  //             type
  //             value
  //           }
  //         }
  //         userErrors {
  //           field
  //           message
  //         }
  //       }
  //     }`;
    
  //     const updateCustomerMetafieldsVariables = {
  //       "input": {
  //         "id": `gid://shopify/Customer/${orderData.customerId}`,
  //         "metafields": [
  //           {
  //             "namespace": "custom",
  //             "key": "total_points_points_exchange",
  //             "type": "number_integer",
  //             "value": `${updatedPoints}`
  //           }
  //         ]
  //       },
  //       "namespace": "custom",
  //       "key": "total_points_points_exchange"
  //     };
  //     const response = await admin.graphql(updateCustomerMetafieldMutation, {
  //       variables: updateCustomerMetafieldsVariables,
  //     });
  
  //     const { data } = await response.json();
  
  //     console.log("Updated Points Metafield2:::", data.customerUpdate)
  //   }
  // } catch (error) {
  //   console.log("Webhook error::", error)
  // }

  return new Response();
};
