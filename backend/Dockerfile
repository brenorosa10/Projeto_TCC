FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Astro.Api.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish Astro.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_HTTP_PORTS=
EXPOSE 8080

ENTRYPOINT ["/bin/sh", "-c", "exec dotnet Astro.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
