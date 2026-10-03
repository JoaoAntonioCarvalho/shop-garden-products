import "server-only";
import type { Resource } from "../resource";
import { faqResource, homeResource, pageResource } from "./content";
import { bannerResource, couponResource, occasionResource, testimonialResource } from "./marketing";
import { holidayResource, redirectResource, shippingRuleResource } from "./system";
import { categoryResource, collectionResource } from "./taxonomy";

const all: Resource[] = [
  couponResource,
  bannerResource,
  testimonialResource,
  occasionResource,
  pageResource,
  faqResource,
  homeResource,
  shippingRuleResource,
  holidayResource,
  redirectResource,
  categoryResource,
  collectionResource,
];

const byKey = new Map(all.map((resource) => [resource.key, resource]));

export function getResource(key: string): Resource | null {
  return byKey.get(key) ?? null;
}
