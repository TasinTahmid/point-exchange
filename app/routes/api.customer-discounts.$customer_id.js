import { authenticate } from "../shopify.server";
import shopify from "../shopify.server";

export const loader = async ({ request, params }) => {
	console.log("Customer id:::", JSON.stringify(params))
  const customerId = params.customer_id;
  const origin = request.headers.get("Origin");

  if (origin !== "https://extensions.shopifycdn.com") {
    return new Response("Forbidden", { status: 403 });
  }

  await authenticate.public.customerAccount(request);

  const {admin} = await shopify.unauthenticated.admin("store-themeog.myshopify.com");

  let discountList;
  const getDiscountsByCustomerIdQuery = `query {
    metaobjects(
      type: "discount_points_exchange"
      first: 100
      query: "customer:gid://shopify/Customer/${customerId}"
    ) {
      edges {
        node {
          fields {
            key
            value
          }
        }
      }
    }
  }`;
  try {
    const response = await admin.graphql( getDiscountsByCustomerIdQuery );
    const { data } = await response.json();
    
    discountList = data.metaobjects.edges.map(edge => {
      const obj = {};
      edge.node.fields.forEach(field => {
        obj[field.key] = field.value;
      });
      return obj;
    });
  } catch (error) {
    console.log("Error from catch:::", error);

    return new Response(JSON.stringify({
      ok: false,
      error: "Failed to fetch discount list",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  let rewardList;
  const getDiscountsByType = `query GetMetaobjectsByType {
    metaobjects(
      type: "reward_list_points_exchange"
      first: 100
    ) {
      edges {
        node {
          fields {
            key
            value
          }
        }
      }
    }
  }`;
  try {
    const response = await admin.graphql( getDiscountsByType );
    const { data } = await response.json();
    
    rewardList = data.metaobjects.edges.map(edge => {
      const obj = {};
      edge.node.fields.forEach(field => {
        obj[field.key] = field.value;
      });
      return obj;
    });
  } catch (error) {
    console.log("Error from catch:::", error);

    return new Response(JSON.stringify({
      ok: false,
      error: "Failed to fetch discount list",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  if(!rewardList && !discountList){
    return new Response(JSON.stringify({
      ok: false,
      error: "No discount records found for customer"
    }), {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const customerDate = {
    discountList,
    rewardList
  };

  return new Response(JSON.stringify(customerDate), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
};

