import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://harisolaas.com/en",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: {
        languages: {
          en: "https://harisolaas.com/en",
          es: "https://harisolaas.com/es",
        },
      },
    },
    {
      url: "https://harisolaas.com/es",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: {
        languages: {
          en: "https://harisolaas.com/en",
          es: "https://harisolaas.com/es",
        },
      },
    },
  ];
}
