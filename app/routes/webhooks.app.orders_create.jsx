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

  if(orderData?.discountCodes?.length == 0) return new Response();

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

  let discountMetaobjectList;
  let metaobjectToRemove;
  try {
    const response = await admin.graphql(GetMetaobjectsByCustomer);

    const { data } = await response.json();

    discountMetaobjectList = data?.metaobjects?.edges?.map(({node}) =>{
      let discount_code;
      node.fields.map(e=>{
        if(e.key == "discount_code"){
          discount_code = e.value;
        }
      })

      if(discount_code == orderData.discountCodes[0].code){
        metaobjectToRemove = node.id;
        return null;
      }
      return node.id;
    });

    console.log("Metaobject to remove:::", metaobjectToRemove)
  } catch (error) {
    console.log("Webhook error::", error)
  }

  if(!discountMetaobjectList){
    return new Response();
  }
  discountMetaobjectList = discountMetaobjectList.filter(id => id !== null);

  const updateCustomerMetafields = `mutation updateCustomerMetafields($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        metafields(first: 3) {
          edges {
            node {
              id
              namespace
              key
              value
            }
          }
        }
      }
      userErrors {
        message
        field
      }
    }
  }`;

  const updateCustomerMetafieldsVariables = {
    "input": {
      "metafields": [
        {
          "namespace": "custom",
          "key": "discount_list_points_exchange",
          "value": JSON.stringify(discountMetaobjectList)
        }
      ],
      "id": `gid://shopify/Customer/${orderData.customerId}`
    }
  }

  try {
    const response = await admin.graphql(updateCustomerMetafields, {
      variables: updateCustomerMetafieldsVariables,
    });

    const { data } = await response.json();

    console.log("Updated Points Metafield2:::",JSON.stringify(data.customerUpdate))
    
  } catch (error) {
    console.log("Webhook error::", error)
  }
  console.log("Deleted metaobject id:::", metaobjectToRemove)
  const DeleteMetaobjectById = `mutation DeleteMetaobjectById($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }`;
  const DeleteMetaobjectVariable = { 
    "id": metaobjectToRemove
  };

  try {
    const response = await admin.graphql(DeleteMetaobjectById, {
      variables: DeleteMetaobjectVariable
    });

    const { data } = await response.json();

    console.log("deleted metaobjects:::",JSON.stringify(data))
    
  } catch (error) {
    console.log("Webhook error::", error)
  }

  return new Response();
};
