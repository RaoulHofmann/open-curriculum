<template>
  <NuxtPage />
</template>

<script setup lang="ts">
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/open-curriculum/service-worker.js", {
      scope: "/open-curriculum/",
    })
    .then((reg) => {
      if (!navigator.serviceWorker.controller) {
        // First install — SW took control, reload so headers apply to this page
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!sessionStorage.getItem("sw-reloaded")) {
            sessionStorage.setItem("sw-reloaded", "1");
            window.location.reload();
          }
        });
      }
    });
}
</script>
