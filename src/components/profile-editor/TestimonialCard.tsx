import { Star, Trash2, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string;
  testimonial_text: string;
  rating: number;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  onDelete: (id: string) => void;
}

const TestimonialCard = ({ testimonial, onDelete }: TestimonialCardProps) => {
  return (
    <Card className="border-2 hover:shadow-md transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {/* Rating Stars */}
            <div className="flex items-center gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < testimonial.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {/* Quote */}
            <div className="relative">
              <Quote className="absolute -left-1 -top-1 h-6 w-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground italic pl-5 leading-relaxed">
                "{testimonial.testimonial_text}"
              </p>
            </div>

            {/* Client Info */}
            <div className="mt-4 pt-3 border-t">
              <p className="font-semibold text-sm">{testimonial.client_name}</p>
              {testimonial.client_title && (
                <p className="text-xs text-muted-foreground">{testimonial.client_title}</p>
              )}
            </div>
          </div>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(testimonial.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestimonialCard;
