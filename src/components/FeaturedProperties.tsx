import PropertyCard from "./PropertyCard";
import property1 from "@/assets/property-1.jpg";
import property2 from "@/assets/property-2.jpg";
import property3 from "@/assets/property-3.jpg";

const FeaturedProperties = () => {
  const properties = [
    {
      image: property1,
      title: "Modern Luxury Apartment",
      price: "$1,074,000",
      address: "75 Fulton Street #21, Boston, MA 02109",
      beds: 3,
      baths: 2,
      sqft: "2,450"
    },
    {
      image: property2,
      title: "Contemporary Family Home",
      price: "$875,000",
      address: "124 Oak Avenue, Cambridge, MA 02138",
      beds: 4,
      baths: 3,
      sqft: "3,200"
    },
    {
      image: property3,
      title: "Downtown Luxury Condo",
      price: "$1,250,000",
      address: "88 Park Street, Boston, MA 02116",
      beds: 2,
      baths: 2,
      sqft: "1,850"
    }
  ];

  return (
    <section id="properties" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Featured Properties</h2>
          <p className="text-xl text-muted-foreground">
            Discover exceptional homes with transparent pricing
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property, index) => (
            <PropertyCard key={index} {...property} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProperties;
