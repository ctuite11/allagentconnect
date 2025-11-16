import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting test agent seeding...');

    const agents = [
      {
        id: 'a1111111-1111-1111-1111-111111111111',
        email: 'sarah.johnson@allagentconnect.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '617-555-0101',
        cellPhone: '617-555-0201',
        company: 'Boston Realty Group',
        title: 'Senior Real Estate Advisor',
        bio: 'Specializing in luxury properties in Greater Boston with over 15 years of experience.',
        officeName: 'Boston Realty Group',
        officeAddress: '100 Federal Street',
        officeCity: 'Boston',
        officeState: 'MA',
        officeZip: '02110',
        counties: ['Suffolk', 'Norfolk'],
        listings: [
          { address: '123 Beacon Street', city: 'Boston', zip: '02116', price: 1250000, beds: 3, baths: 2.5, sqft: 2200, type: 'condo', desc: 'Stunning Back Bay condo with modern finishes and city views.', yearBuilt: 2015 },
          { address: '456 Commonwealth Ave', city: 'Boston', zip: '02215', price: 2850000, beds: 4, baths: 3.5, sqft: 3500, type: 'single_family', desc: 'Elegant brownstone in prime location near BU.', lotSize: 0.15, yearBuilt: 1895 },
          { address: '789 Marlborough Street', city: 'Boston', zip: '02116', price: 975000, beds: 2, baths: 2, sqft: 1400, type: 'condo', desc: 'Charming Victorian-style condo in the heart of Back Bay.', yearBuilt: 2010 }
        ]
      },
      {
        id: 'a2222222-2222-2222-2222-222222222222',
        email: 'michael.chen@allagentconnect.com',
        firstName: 'Michael',
        lastName: 'Chen',
        phone: '617-555-0102',
        cellPhone: '617-555-0202',
        company: 'Metro Properties',
        title: 'Real Estate Broker',
        bio: 'Expert in Cambridge and Somerville markets, helping families find their perfect home.',
        officeName: 'Metro Properties',
        officeAddress: '50 Church Street',
        officeCity: 'Cambridge',
        officeState: 'MA',
        officeZip: '02138',
        counties: ['Middlesex'],
        listings: [
          { address: '25 Harvard Street', city: 'Cambridge', zip: '02138', price: 1650000, beds: 4, baths: 3, sqft: 2800, type: 'single_family', desc: 'Beautiful family home near Harvard Square with private yard.', lotSize: 0.25, yearBuilt: 1920 },
          { address: '88 Prospect Street', city: 'Somerville', zip: '02143', price: 925000, beds: 3, baths: 2, sqft: 1800, type: 'townhouse', desc: 'Modern townhouse with rooftop deck in Davis Square.', yearBuilt: 2018 }
        ]
      },
      {
        id: 'a3333333-3333-3333-3333-333333333333',
        email: 'jennifer.murphy@allagentconnect.com',
        firstName: 'Jennifer',
        lastName: 'Murphy',
        phone: '508-555-0103',
        cellPhone: '508-555-0203',
        company: 'Cape Cod Estates',
        title: 'Luxury Home Specialist',
        bio: 'Your trusted partner for Cape Cod waterfront and vacation properties.',
        officeName: 'Cape Cod Estates',
        officeAddress: '75 Main Street',
        officeCity: 'Hyannis',
        officeState: 'MA',
        officeZip: '02601',
        counties: ['Barnstable'],
        listings: [
          { address: '100 Ocean Drive', city: 'Hyannis', zip: '02601', price: 2250000, beds: 5, baths: 4, sqft: 3800, type: 'single_family', desc: 'Spectacular waterfront estate with private beach access.', lotSize: 1.2, yearBuilt: 2005 },
          { address: '45 Sea View Lane', city: 'Barnstable', zip: '02630', price: 875000, beds: 3, baths: 2, sqft: 2100, type: 'single_family', desc: 'Charming Cape Cod style home with water views.', lotSize: 0.5, yearBuilt: 1985 },
          { address: '200 Harbor Road', city: 'Yarmouth', zip: '02664', price: 1350000, beds: 4, baths: 3, sqft: 2600, type: 'single_family', desc: 'Beautiful beach house with sunset views.', lotSize: 0.75, yearBuilt: 2000 }
        ]
      },
      {
        id: 'a4444444-4444-4444-4444-444444444444',
        email: 'david.walsh@allagentconnect.com',
        firstName: 'David',
        lastName: 'Walsh',
        phone: '413-555-0104',
        cellPhone: '413-555-0204',
        company: 'Western Mass Realty',
        title: 'Residential Specialist',
        bio: 'Serving the Pioneer Valley with integrity and local expertise for 20 years.',
        officeName: 'Western Mass Realty',
        officeAddress: '200 Main Street',
        officeCity: 'Springfield',
        officeState: 'MA',
        officeZip: '01103',
        counties: ['Hampden', 'Hampshire'],
        listings: [
          { address: '350 Maple Street', city: 'Springfield', zip: '01108', price: 425000, beds: 4, baths: 2.5, sqft: 2400, type: 'single_family', desc: 'Spacious colonial in desirable neighborhood with large yard.', lotSize: 0.4, yearBuilt: 1965 },
          { address: '75 College Highway', city: 'Northampton', zip: '01060', price: 585000, beds: 3, baths: 2, sqft: 2000, type: 'single_family', desc: 'Updated home near downtown with modern amenities.', lotSize: 0.3, yearBuilt: 1950 }
        ]
      },
      {
        id: 'a5555555-5555-5555-5555-555555555555',
        email: 'emily.rodriguez@allagentconnect.com',
        firstName: 'Emily',
        lastName: 'Rodriguez',
        phone: '978-555-0105',
        cellPhone: '978-555-0205',
        company: 'North Shore Properties',
        title: 'Buyer Representative',
        bio: 'Helping first-time buyers navigate the North Shore market with confidence.',
        officeName: 'North Shore Properties',
        officeAddress: '45 Essex Street',
        officeCity: 'Salem',
        officeState: 'MA',
        officeZip: '01970',
        counties: ['Essex'],
        listings: [
          { address: '150 Lafayette Street', city: 'Salem', zip: '01970', price: 675000, beds: 3, baths: 2.5, sqft: 2200, type: 'single_family', desc: 'Historic home with period details and modern updates.', lotSize: 0.2, yearBuilt: 1880 },
          { address: '88 Washington Street', city: 'Marblehead', zip: '01945', price: 1450000, beds: 4, baths: 3, sqft: 3000, type: 'single_family', desc: 'Stunning waterfront property with harbor views.', lotSize: 0.6, yearBuilt: 1995 }
        ]
      },
      {
        id: 'a6666666-6666-6666-6666-666666666666',
        email: 'robert.thompson@allagentconnect.com',
        firstName: 'Robert',
        lastName: 'Thompson',
        phone: '781-555-0106',
        cellPhone: '781-555-0206',
        company: 'MetroWest Homes',
        title: 'Real Estate Consultant',
        bio: 'Expert in MetroWest suburbs, specializing in family homes and relocations.',
        officeName: 'MetroWest Homes',
        officeAddress: '125 Worcester Street',
        officeCity: 'Framingham',
        officeState: 'MA',
        officeZip: '01701',
        counties: ['Middlesex', 'Worcester'],
        listings: [
          { address: '225 Union Avenue', city: 'Framingham', zip: '01702', price: 625000, beds: 4, baths: 2.5, sqft: 2600, type: 'single_family', desc: 'Family-friendly home with finished basement in great school district.', lotSize: 0.35, yearBuilt: 1978 },
          { address: '50 Main Street', city: 'Natick', zip: '01760', price: 775000, beds: 3, baths: 2, sqft: 2200, type: 'single_family', desc: 'Updated colonial near shopping and commuter rail.', lotSize: 0.28, yearBuilt: 1985 }
        ]
      },
      {
        id: 'a7777777-7777-7777-7777-777777777777',
        email: 'amanda.silva@allagentconnect.com',
        firstName: 'Amanda',
        lastName: 'Silva',
        phone: '508-555-0107',
        cellPhone: '508-555-0207',
        company: 'South Coast Realty',
        title: 'Senior Agent',
        bio: 'Dedicated to serving New Bedford and Fall River with exceptional service.',
        officeName: 'South Coast Realty',
        officeAddress: '300 Purchase Street',
        officeCity: 'New Bedford',
        officeState: 'MA',
        officeZip: '02740',
        counties: ['Bristol'],
        listings: [
          { address: '400 County Street', city: 'New Bedford', zip: '02740', price: 385000, beds: 3, baths: 2, sqft: 1800, type: 'single_family', desc: 'Well-maintained home with hardwood floors throughout.', lotSize: 0.25, yearBuilt: 1960 },
          { address: '125 South Main Street', city: 'Fall River', zip: '02721', price: 325000, beds: 3, baths: 1.5, sqft: 1600, type: 'single_family', desc: 'Charming starter home in quiet neighborhood.', lotSize: 0.2, yearBuilt: 1955 }
        ]
      },
      {
        id: 'a8888888-8888-8888-8888-888888888888',
        email: 'christopher.lee@allagentconnect.com',
        firstName: 'Christopher',
        lastName: 'Lee',
        phone: '617-555-0108',
        cellPhone: '617-555-0208',
        company: 'Greater Boston Advisors',
        title: 'Investment Property Specialist',
        bio: 'Maximizing returns for real estate investors in the Boston metro area.',
        officeName: 'Greater Boston Advisors',
        officeAddress: '85 Devonshire Street',
        officeCity: 'Boston',
        officeState: 'MA',
        officeZip: '02109',
        counties: ['Suffolk', 'Middlesex'],
        listings: [
          { address: '75 Tremont Street', city: 'Boston', zip: '02108', price: 1850000, beds: 0, baths: 0, sqft: 4500, type: 'commercial', desc: 'Prime commercial space in downtown Boston.', yearBuilt: 1920 },
          { address: '300 Huntington Ave', city: 'Boston', zip: '02115', price: 3250000, beds: 8, baths: 6, sqft: 6800, type: 'multi_family', desc: 'Excellent investment property near universities.', lotSize: 0.2, yearBuilt: 1910 }
        ]
      },
      {
        id: 'a9999999-9999-9999-9999-999999999999',
        email: 'lisa.anderson@allagentconnect.com',
        firstName: 'Lisa',
        lastName: 'Anderson',
        phone: '508-555-0109',
        cellPhone: '508-555-0209',
        company: 'Worcester County Homes',
        title: 'Relocation Specialist',
        bio: 'Making your move to Central Massachusetts smooth and stress-free.',
        officeName: 'Worcester County Homes',
        officeAddress: '450 Main Street',
        officeCity: 'Worcester',
        officeState: 'MA',
        officeZip: '01608',
        counties: ['Worcester'],
        listings: [
          { address: '500 Main Street', city: 'Worcester', zip: '01608', price: 395000, beds: 3, baths: 2, sqft: 2000, type: 'single_family', desc: 'Move-in ready home with updated kitchen and baths.', lotSize: 0.3, yearBuilt: 1970 },
          { address: '88 Lincoln Street', city: 'Worcester', zip: '01605', price: 475000, beds: 4, baths: 2.5, sqft: 2400, type: 'single_family', desc: 'Spacious colonial in West Side neighborhood.', lotSize: 0.4, yearBuilt: 1965 }
        ]
      },
      {
        id: 'b0000000-0000-0000-0000-000000000000',
        email: 'james.mccarthy@allagentconnect.com',
        firstName: 'James',
        lastName: 'McCarthy',
        phone: '617-555-0110',
        cellPhone: '617-555-0210',
        company: 'South Shore Properties',
        title: 'Coastal Real Estate Expert',
        bio: 'Specializing in Plymouth County waterfront and beach communities.',
        officeName: 'South Shore Properties',
        officeAddress: '50 Court Street',
        officeCity: 'Plymouth',
        officeState: 'MA',
        officeZip: '02360',
        counties: ['Plymouth'],
        listings: [
          { address: '200 Water Street', city: 'Plymouth', zip: '02360', price: 895000, beds: 4, baths: 3, sqft: 2800, type: 'single_family', desc: 'Beautiful coastal home with ocean access.', lotSize: 0.5, yearBuilt: 2000 },
          { address: '75 Sandwich Street', city: 'Plymouth', zip: '02360', price: 725000, beds: 3, baths: 2.5, sqft: 2200, type: 'single_family', desc: 'Historic district home with modern amenities.', lotSize: 0.35, yearBuilt: 1880 }
        ]
      }
    ];

    // Get county IDs
    const { data: counties } = await supabaseAdmin
      .from('counties')
      .select('id, name, state')
      .eq('state', 'MA');

    if (!counties) {
      throw new Error('Failed to fetch counties');
    }

    const countyMap = new Map(counties.map(c => [c.name, c.id]));

    let successCount = 0;
    const results = [];

    for (const agent of agents) {
      try {
        console.log(`Creating agent: ${agent.firstName} ${agent.lastName}`);

        // Create auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: agent.email,
          password: 'TestPassword123!',
          email_confirm: true,
          user_metadata: {
            first_name: agent.firstName,
            last_name: agent.lastName
          }
        });

        if (authError) {
          console.error(`Auth error for ${agent.email}:`, authError);
          results.push({ email: agent.email, success: false, error: authError.message });
          continue;
        }

        // Create user role
        await supabaseAdmin.from('user_roles').insert({
          user_id: authUser.user.id,
          role: 'agent'
        });

        // Create agent profile
        await supabaseAdmin.from('agent_profiles').insert({
          id: authUser.user.id,
          first_name: agent.firstName,
          last_name: agent.lastName,
          email: agent.email,
          phone: agent.phone,
          cell_phone: agent.cellPhone,
          company: agent.company,
          title: agent.title,
          bio: agent.bio,
          office_name: agent.officeName,
          office_address: agent.officeAddress,
          office_city: agent.officeCity,
          office_state: agent.officeState,
          office_zip: agent.officeZip,
          receive_buyer_alerts: true
        });

        // Add state preference
        await supabaseAdmin.from('agent_state_preferences').insert({
          agent_id: authUser.user.id,
          state: 'MA'
        });

        // Add county preferences
        const countyInserts = agent.counties.map(countyName => ({
          agent_id: authUser.user.id,
          county_id: countyMap.get(countyName)
        }));
        await supabaseAdmin.from('agent_county_preferences').insert(countyInserts);

        // Create listings
        const listingInserts = agent.listings.map(listing => ({
          agent_id: authUser.user.id,
          address: listing.address,
          city: listing.city,
          state: 'MA',
          zip_code: listing.zip,
          price: listing.price,
          bedrooms: listing.beds,
          bathrooms: listing.baths,
          square_feet: listing.sqft,
          property_type: listing.type,
          status: 'active',
          description: listing.desc,
          lot_size: listing.lotSize || null,
          year_built: listing.yearBuilt
        }));
        await supabaseAdmin.from('listings').insert(listingInserts);

        successCount++;
        results.push({ 
          email: agent.email, 
          success: true,
          listingCount: agent.listings.length
        });
        console.log(`✓ Created agent ${agent.firstName} ${agent.lastName} with ${agent.listings.length} listings`);
      } catch (error) {
        console.error(`Error creating agent ${agent.email}:`, error);
        results.push({ 
          email: agent.email, 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`Seeding complete: ${successCount}/${agents.length} agents created`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully created ${successCount} out of ${agents.length} test agents`,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Seeding error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
