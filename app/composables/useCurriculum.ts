import { useNuxtApp } from "nuxt/app";

const { $api } = useNuxtApp();
console.log($api);
// const { data, error } = await $api.curriculum.ask.get({
//   query: { q: "fractions" },
// });
