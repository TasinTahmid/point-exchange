import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const [customerId, setCustomerId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [totalPoints, setTotalPoints] = useState(null);
  const [discountList, setDiscountList] = useState(null);
  const [rewardList, setRewardList] = useState(null);

  const handleCreateDiscount = async (data) =>{
    console.log("discount data:::", data)
    const { cost, discount, discountType, customerId} = data;
  
    try{
      const payload = {
        cost,
        discount,
        discountType,
        customerId,
        totalPoints
      };

      const response = await fetch('https://resident-volunteer-dance-operated.trycloudflare.com/api/discount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Discount response::::::::::', data);

      const { discountResponse, customerMetafieldsResponse, updatedDiscountList } = data.finalResponse;

      let updatedPoints;
      customerMetafieldsResponse.customer.metafields.edges.forEach(({node}) => {
        if(node?.key == "total_points_points_exchange" && node?.namespace == "custom"){
          updatedPoints = node?.value;
        }
      });

      if(updatedPoints){
        setTotalPoints(updatedPoints);
      }
      if(updatedDiscountList){
        setDiscountList(updatedDiscountList);
      }

    } catch (error) {
      console.error('API Error:', error);
    }
  }

  useEffect(() => {
    async function callApi() {
      const token = await shopify.sessionToken.get();
      console.log("Token:::6", token.substring(0,10));
      setSessionToken(token);

      // const res = await fetch(
      //   "https://weed-roof-admissions-builders.trycloudflare.com/api/discount",
      //   {
      //     headers: {
      //       Authorization: `Bearer ${token}`,
      //       "Content-Type": "application/json"
      //     }
      //   }
      // );

      // const data = await res.json();

      const getCustomerNameQuery = {
        query: `query {
          customer {
            id
            firstName
            totalPoints: metafield(namespace: "custom", key: "total_points_points_exchange") {
              key
              value
            }
            discountList: metafield(namespace: "custom", key: "discount_list_points_exchange") {
              key
              value
            }
          }
        }`,
      };
      const res = await fetch(
        `shopify://customer-account/api/2025-10/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            getCustomerNameQuery,
          ),
        },
      );
      const { data } = await res.json();

      console.log("Customer data:", data);
      if(data?.customer?.id){
        console.log("Customer totalPoints:", data.customer.id);
        setCustomerId(data.customer.id)
      }
      if(data?.customer?.totalPoints?.value){
        console.log("Customer totalPoints:", data?.customer?.totalPoints?.value);
        const intValue = Number(data.customer.totalPoints.value)
        setTotalPoints(intValue)
      }
      if(data?.customer?.discountList?.value){
        const value = JSON.parse(data?.customer?.discountList?.value);
        console.log("Customer discountList:", value);
        setDiscountList(value)
      }
    }

    callApi();
  }, []);
  useEffect(() => {
    async function callApi() {
      const customerIdCode = customerId.split("/").at(-1);

      console.log("customerID:::", customerId)
      const res = await fetch(
        `https://resident-volunteer-dance-operated.trycloudflare.com/api/customer-discounts/${customerIdCode}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("after fetch:::")
      const data = await res.json();

      console.log("Discount List and Reward List data:", data);
      
      if(data?.discountList){
        setDiscountList(data.discountList)
      }
      if(data?.rewardList){
        setRewardList(data.rewardList)
      }
    }

    if(customerId){
      callApi();
    }
  }, [customerId, setCustomerId]);

  return (
    <s-section heading="Points & Discounts" >
      <s-box padding="large" />
      <s-section heading='Your Points'>
      <s-box padding="small" />
        <s-badge tone="neutral" color="subdued" >
          {totalPoints ? totalPoints : "You don't have any points to exchange"}
        </s-badge>
      </s-section>
      <s-box padding="large" />

      {rewardList && <s-section heading="Reward List">
        <RewardsTable 
          rows={rewardList} 
          totalPoints={totalPoints} 
          customerId={customerId} 
          handleCreateDiscount={handleCreateDiscount}
          />
      </s-section>}
        
      <s-box padding="large" />

      {discountList && <s-section heading="Your Discounts">
        <DiscountTable rows={discountList} />
      </s-section>}

    </s-section>
    
  );
}

function RewardsTable({rows, totalPoints, customerId, handleCreateDiscount}) {
  return (
    <>
      <s-stack direction="inline" gap="base" paddingBlockStart="base">
        <s-box padding="large" minInlineSize="150px">
          <s-text type='strong'> Cost (in points)</s-text>
        </s-box>
        <s-box padding="large" minInlineSize="150px">
          <s-text type='strong'> Discount</s-text>
        </s-box>
        <s-box padding="large" minInlineSize="150px">
          <s-text type='strong'> Type</s-text>
        </s-box>
        <s-box padding="large" minInlineSize="150px">
          <s-text type='strong'> Trade</s-text>
        </s-box>
      </s-stack>
      {rows.map((row, i) => (
        <s-stack direction="inline" gap="base" paddingBlockStart="base">
          <s-box padding="large" minInlineSize="150px">
            { row.cost_points }
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            { row.discount_amount }
            {row.type == "Percentage"? "%":"BDT"}
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            {row.type}
          </s-box>
          <s-box padding="small" minInlineSize="150px">
            {Number(totalPoints) >= Number(row.cost_points) ? 
            <s-button 
            onClick={(e) => handleCreateDiscount({
              customerId: customerId,
              cost: row.cost_points,
              discount: row.discount_amount, 
              discountType: row.type 
            })}
            >Redeem</s-button> 
            : <s-button disabled>Redeem</s-button> }
          </s-box>
        </s-stack>
      ))}
    </>
  );
}


function DiscountTable({rows}) {
  return (
    <>
        <s-stack direction="inline" gap="base" paddingBlockStart="base">
          <s-box padding="large" minInlineSize="220px">
            <s-text type='strong'>Discount Code</s-text>
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            <s-text type='strong'>Discount</s-text> 
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            <s-text type='strong'>Type</s-text> 
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            <s-text type='strong'>Status</s-text> 
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            <s-text type='strong'>Validity</s-text> 
          </s-box>
        </s-stack>
      {rows.map((row, i) => (
        <s-stack direction="inline" gap="base" paddingBlockStart="base">
          <s-box padding="large" minInlineSize="220px">
            { row.discount_code }
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            { row.discount_amount }
            {row.type == "Percentage"? "%":"BDT"}
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            {row.type}
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            <s-badge >
              {row.status}
            </s-badge>
          </s-box>
          <s-box padding="large" minInlineSize="150px">
            {row.validity}
          </s-box>
        </s-stack>
      ))}
    </>
  );
}