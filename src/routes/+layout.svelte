<script>
  import '../app.css'; // This connects your CSS to the app
  let { children } = $props(); // Svelte 5 syntax
</script>

{@render children()}