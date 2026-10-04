class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.2.0"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.2.0/adotui-macos-x64"
      sha256 "0621e6725e3498f4dbc50d777ec4b1beba52d97434c8b23e82043c523995aacd"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.2.0/adotui-macos-arm64"
      sha256 "dceaa30646c60f05a578efa920b3e515b4da8531e0e173a91bf6276450c1af90"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.2.0/adotui-linux-x64"
      sha256 "e5eb0eea573a8b3e76cb2d63312e8072fc3fd3ae476f86cd6fad9864c36634e9"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.2.0/adotui-linux-arm64"
      sha256 "ef47000a8d096200019141eae36d3bb83adf05c4b90625cd8961c51403d93cd2"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
