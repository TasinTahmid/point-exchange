import { authenticate } from "../shopify.server";
import shopify from "../shopify.server";
import { random10DigitNumber } from "../utils/random-number"; 
import { getDateOneYearFromNow } from "../utils/date";

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
              endsAt
              status
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
  const customerGetsValue = discountType == "Percentage" ? { percentage: discount/100 } : { "discountAmount": {"amount":discount*1.000}};

  const CREATE_DISCOUNT_CODE_MUTATION_VARIABLES = {
    basicCodeDiscount: {
      title: discoutCode,
      code: discoutCode,
      startsAt: "2025-12-04T00:00:00Z",
      endsAt: getDateOneYearFromNow(),
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

    const { data } = await response.json();

    discountResponse = data?.discountCodeBasicCreate;
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

  const newCodeDiscount = discountResponse.codeDiscountNode.codeDiscount;

  const CreateMetaobjectEntryMutation = `mutation CreateMetaobjectEntry($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        type
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;
  const validity = newCodeDiscount.endsAt.split("T")[0];
  
  const CreateMetaobjectEntryVariables = {
    "metaobject": {
      "type": "discount_points_exchange",
      "handle": `${newCodeDiscount.title}`,
      "fields": [
        {
          "key": "customer",
          "value": `${customerId}`
        },
        {
          "key": "discount_code",
          "value": `${newCodeDiscount.title}`
        },
        {
          "key": "discount_amount",
          "value": `${discount}`
        },
        {
          "key": "type",
          "value": `${discountType}`
        },
        {
          "key": "status",
          "value": "Active"
        },
        {
          "key": "validity",
          "value": `${validity}`
        }
      ]
    }
  };

  let newDiscountMetaobjectEntryID;
  try {
    const response = await admin.graphql(CreateMetaobjectEntryMutation, {
      variables: CreateMetaobjectEntryVariables,
    });

    const { data } = await response.json();

    newDiscountMetaobjectEntryID = data.metaobjectCreate.metaobject.id;

    console.log("newDiscountMetaobjectEntry:::", newDiscountMetaobjectEntryID)
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

  const GetMetaobjectsByCustomer = `query GetMetaobjectsByCustomer {
    metaobjects(
      type: "discount_points_exchange"
      first: 100
      query: "customer:${customerId}"
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

  let discountPointExchangeMetaobjects;
  let updatedDiscountList;
  try {
    const response = await admin.graphql(GetMetaobjectsByCustomer);

    const { data } = await response.json();

    console.log("Metaobject list:::", data.metaobjects.edges)
    discountPointExchangeMetaobjects = data.metaobjects.edges.map(item => item.node.id);
    updatedDiscountList = data.metaobjects.edges.map(edge => {
      const obj = {};
      edge.node.fields.forEach(field => {
        obj[field.key] = field.value;
      });
      return obj;
    });
  } catch (error) {
    console.log("Metaobject list error:::", error)

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

console.log("discountPointExchangeMetaobjects:::",discountPointExchangeMetaobjects)
  const updateCustomerMetafieldsMutation = `mutation updateCustomerMetafields($input: CustomerInput!) {
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
          "key": "total_points_points_exchange",
          "type": "number_integer",
          "value": `${totalPoints-cost}`
        },
        {
          "namespace": "custom",
          "key": "discount_list_points_exchange",
          "value": `${JSON.stringify(discountPointExchangeMetaobjects)}`
        }
      ],
      "id": `${customerId}`
    }
  };

  let customerMetafieldsResponse;

  try {
    const response = await admin.graphql(updateCustomerMetafieldsMutation, {
      variables: updateCustomerMetafieldsVariables,
    });

    const { data } = await response.json();

    console.log("Updated Metafield:::",data?.customerUpdate)
    customerMetafieldsResponse =  data?.customerUpdate;
  } catch (error) {
    console.log("Metafields update error::",error)
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
    const finalResponse = {discountResponse, customerMetafieldsResponse, updatedDiscountList}
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

