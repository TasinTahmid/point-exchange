import { authenticate } from "../shopify.server";
import shopify from "../shopify.server";
import { random10DigitNumber } from "../utils/random-number";

export const loader = async ({ request }) => {
  const origin = request.headers.get("Origin");

  if (origin !== "https://extensions.shopifycdn.com") {
    return new Response("Forbidden", { status: 403 });
  }

  await authenticate.public.customerAccount(request);

  const {admin} = await shopify.unauthenticated.admin("store-themeog.myshopify.com");

  return new Response(JSON.stringify({"okay": true}), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
};

export const action = async ({ request }) => {
  const origin = request.headers.get("Origin");
  
  if (origin !== "https://extensions.shopifycdn.com") {
    return new Response("Forbidden", { status: 403 });
  }
  
  const auth = await authenticate.public.customerAccount(request);
  const payload = await request.json();
  const { totalPoints, cost, discount, discountType, customerId } = payload;

  const {admin} = await shopify.unauthenticated.admin("store-themeog.myshopify.com");

  const customerGetsQuery = discountType == "Percentage" ? 
                  `... on DiscountPercentage {
                    percentage
                  }` :
                  `... on DiscountAmount {
                    amount {
                      amount
                    }
                    appliesOnEachItem
                  }`;
  const CREATE_DISCOUNT_CODE_MUTATION = `
    mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              startsAt
              customerGets {
                value {
                  ${customerGetsQuery}
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const discoutCode = "point_exchange"+random10DigitNumber();
  const customerGetsValue = discountType == "Percentage" ? { percentage: discount/100} : { "discountAmount": {"amount":discount*1.000}};

  const CREATE_DISCOUNT_CODE_MUTATION_VARIABLES = {
    basicCodeDiscount: {
      title: discoutCode,
      code: discoutCode,
      startsAt: "2025-12-04T00:00:00Z",
      customerSelection: {
        customers: {
          add: [`${customerId}`],
        },
      },
      customerGets: {
        value: customerGetsValue,
        items: {
          all: true,
        },
      },
      minimumRequirement: {
        subtotal: {
          greaterThanOrEqualToSubtotal: "50.0",
        },
      },
      usageLimit: 1,
      appliesOncePerCustomer: true,
    },
  };

  let discountResponse;

  try {
    const response = await admin.graphql(CREATE_DISCOUNT_CODE_MUTATION, {
      variables: CREATE_DISCOUNT_CODE_MUTATION_VARIABLES,
    });

    const discountData = await response.json();

    discountResponse = discountData;
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error }),
      {
        status: 500,
          headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      },
    );
  }

  const updateCustomerMetafieldsMutation = `mutation updateCustomerMetafield($input: CustomerInput!, $namespace: String!, $key: String!) {
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
      "id": `${customerId}`,
      "metafields": [
        {
          "namespace": "custom",
          "key": "total_points_points_exchange",
          "type": "number_integer",
          "value": `${totalPoints-cost}`
        }
      ]
    },
    "namespace": "custom",
    "key": "total_points_points_exchange"
  };

  let customerMetafieldsResponse;

  try {
    const response = await admin.graphql(updateCustomerMetafieldsMutation, {
      variables: updateCustomerMetafieldsVariables,
    });

    const { data } = await response.json();

    console.log("Updated Metafield:::", data.customerUpdate.customer)
    customerMetafieldsResponse =  data.customerUpdate.customer.metafield;
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error }),
      {
        status: 500,
          headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      },
    );
  }

  if(discountResponse && customerMetafieldsResponse){
    const finalResponse = {discountResponse, customerMetafieldsResponse}
    return new Response(JSON.stringify({ success: true, finalResponse }), {
      status: 201,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

};

